import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const query = searchParams.get('query') || 'science'
    
    const response = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=1`, {
      headers: {
        Authorization: process.env.PEXELS_API_KEY || ''
      }
    })

    if (!response.ok) {
      console.error('Pexels API error status:', response.status)
      return NextResponse.json({ error: 'Failed to fetch from Pexels' }, { status: response.status })
    }

    const data = await response.json()
    const imageUrl = data.photos?.[0]?.src?.landscape || data.photos?.[0]?.src?.large || ''
    
    return NextResponse.json({ imageUrl })
  } catch (error) {
    console.error('Pexels API route error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
