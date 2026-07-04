import { NextResponse } from 'next/server'
import { buildSystemPrompt } from '@/lib/ponytail'

console.log('PEXELS KEY EXISTS:', !!process.env.PEXELS_API_KEY)

export async function POST(req: Request) {
  console.log('=== GROQ ROUTE CALLED ===')
  console.log('KEY EXISTS:', !!process.env.GROQ_API_KEY)
  console.log('KEY PREVIEW:', process.env.GROQ_API_KEY?.slice(0,10))

  const { prompt, system } = await req.json()

  let userPrompt = prompt
  let systemPrompt = system

  const ponytailCommands = [
    "ponytail",
    "ponytail-review",
    "ponytail-audit",
    "ponytail-debt",
    "ponytail-gain",
    "ponytail-help"
  ]

  let activeSkill = "ponytail"

  for (const skill of ponytailCommands) {
    if (userPrompt.startsWith("/" + skill)) {
      activeSkill = skill
      userPrompt = userPrompt
        .replace("/" + skill, "")
        .trim()
      break
    }
  }

  systemPrompt = buildSystemPrompt(
    systemPrompt,
    activeSkill
  )

  const response = await fetch(
    'https://api.groq.com/openai/v1/chat/completions',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: 300,
        temperature: 0.7
      })
    }
  )
  
  const data = await response.json()
  console.log('Groq status:', response.status)
  
  const text = data.choices?.[0]?.message?.content
  
  if (!text) {
    return NextResponse.json(
      { error: 'Groq failed' },
      { status: 500 }
    )
  }
  
  return NextResponse.json({ text })
}
