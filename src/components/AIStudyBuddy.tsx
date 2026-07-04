"use client"

import { useState, useEffect, useRef } from "react"
import {
  Brain,
  UploadCloud,
  FileText,
  Send,
  Loader2,
  Sparkles,
  ExternalLink,
  BookOpen,
  ArrowRight,
  Sparkle,
  Settings,
  HelpCircle,
  Video,
  X,
  Trash2,
  Terminal,
  Heart,
  Layers,
  Zap,
  MessageSquare,
  Image,
  Palette,
  Volume2,
  Music,
  Search,
  Globe,
  BarChart3,
  Box,
  Presentation,
  PenTool,
  Mic,
  Tv,
  Code2,
} from "lucide-react"

interface AIStudyBuddyProps {
  isTeacher?: boolean
}

interface ToolItem {
  id: string
  name: string
  tag: string
  description: string
  guide: string
  url: string
  icon: any
  color: string
  bgColor: string
}

interface YTVideo {
  id: string
  title: string
  thumbnail: string
}

interface Concept {
  title: string
  desc: string
  imgPrompt: string
  imageUrl?: string
  videos?: YTVideo[]
}

const aiTools: ToolItem[] = [
  {
    id: "antigravity",
    name: "Antigravity AI",
    tag: "Agentic Coding",
    description: "Advanced AI coding agent by Google DeepMind.",
    guide: "Best for codebase-wide refactoring, complex bug debugging, and pair programming. It runs commands, edits files, and solves end-to-end tasks autonomously in your IDE workspace.",
    url: "https://github.com",
    icon: Terminal,
    color: "text-emerald-400",
    bgColor: "bg-emerald-500/10 border-emerald-500/20",
  },
  {
    id: "lovable",
    name: "Lovable.dev",
    tag: "App Builder",
    description: "Build, deploy, and edit full stack web applications in English.",
    guide: "Best for non-technical users or quick prototyping. You describe your web app in plain English, and Lovable generates, styles, and deploys it immediately with full-stack functionality.",
    url: "https://lovable.dev",
    icon: Heart,
    color: "text-pink-450 text-rose-400",
    bgColor: "bg-rose-500/10 border-rose-500/20",
  },
  {
    id: "v0",
    name: "v0 by Vercel",
    tag: "UI Generation",
    description: "Generate production-ready React and Tailwind components.",
    guide: "Best for frontend developers looking for premium, responsive layouts. Type a prompt describing a component, layout, or copy-paste an image, and get copy-pasteable React + Tailwind code instantly.",
    url: "https://v0.dev",
    icon: Layers,
    color: "text-purple-400",
    bgColor: "bg-purple-500/10 border-purple-500/20",
  },
  {
    id: "bolt",
    name: "Bolt.new",
    tag: "Web Builder",
    description: "In-browser stack builder powered by WebContainers.",
    guide: "Best for running full-stack Node.js environments directly in the browser. You can prompt, preview, edit, and deploy full applications without installing any local development tools.",
    url: "https://bolt.new",
    icon: Zap,
    color: "text-yellow-450 text-amber-400",
    bgColor: "bg-amber-500/10 border-amber-500/20",
  },
  {
    id: "cursor",
    name: "Cursor",
    tag: "AI Editor",
    description: "The AI-first code editor designed for pair programming.",
    guide: "Best for software engineers. Built as a fork of VS Code, it includes built-in inline editing, codebase-wide chat, and auto-completions powered by state-of-the-art LLMs.",
    url: "https://cursor.sh",
    icon: Code2,
    color: "text-sky-400",
    bgColor: "bg-sky-500/10 border-sky-500/20",
  },
  {
    id: "chatgpt",
    name: "ChatGPT",
    tag: "Assistant",
    description: "OpenAI's general intelligence chat interface.",
    guide: "Best for general brainstorming, text drafting, summarizing, and basic programming assistance across an extremely broad range of topics.",
    url: "https://chat.openai.com",
    icon: MessageSquare,
    color: "text-teal-400",
    bgColor: "bg-teal-500/10 border-teal-500/20",
  },
  {
    id: "claude",
    name: "Claude AI",
    tag: "Reasoning",
    description: "Anthropic's advanced model with high reasoning capacity.",
    guide: "Best for long-document analysis, coding, math, complex logic, and professional-grade writing with a friendly, articulate persona.",
    url: "https://claude.ai",
    icon: Sparkles,
    color: "text-orange-450 text-amber-550 text-orange-400",
    bgColor: "bg-orange-500/10 border-orange-500/20",
  },
  {
    id: "gemini",
    name: "Gemini",
    tag: "Multimodal",
    description: "Google's native multimodal model for text, audio, and video.",
    guide: "Best for cross-referencing videos, audio clips, and large PDFs together. It has a massive context window capable of ingestion of entire codebases or textbooks.",
    url: "https://gemini.google.com",
    icon: Brain,
    color: "text-indigo-400",
    bgColor: "bg-indigo-500/10 border-indigo-500/20",
  },
  {
    id: "midjourney",
    name: "Midjourney",
    tag: "Creative Art",
    description: "Photorealistic AI image generation engine via Discord.",
    guide: "Best for artists, designers, and marketers. Generates highly styled, beautiful illustrations and concept art using natural language prompts.",
    url: "https://midjourney.com",
    icon: Image,
    color: "text-rose-455 text-fuchsia-400",
    bgColor: "bg-fuchsia-500/10 border-fuchsia-500/20",
  },
  {
    id: "stablediffusion",
    name: "Stable Diffusion",
    tag: "Open Art",
    description: "Open-source text-to-image generator with local runtime.",
    guide: "Best for developers and power users. Provides full parameter control, controlnets, and custom training adapters (LoRAs) to customize image generation.",
    url: "https://stability.ai",
    icon: Palette,
    color: "text-violet-400",
    bgColor: "bg-violet-500/10 border-violet-500/20",
  },
  {
    id: "elevenlabs",
    name: "ElevenLabs",
    tag: "Audio Synthesis",
    description: "Realistic text-to-speech and voice cloning.",
    guide: "Best for narrations, audiobooks, podcasts, and video voiceovers. Offers natural inflection, multi-lingual support, and high fidelity voice cloning.",
    url: "https://elevenlabs.io",
    icon: Volume2,
    color: "text-cyan-400",
    bgColor: "bg-cyan-500/10 border-cyan-500/20",
  },
  {
    id: "suno",
    name: "Suno AI",
    tag: "Music Creator",
    description: "Generate full songs with lyrics and vocals.",
    guide: "Best for music enthusiasts and creators. Type a prompt describing a genre, mood, or custom lyrics, and Suno will generate a fully arranged 2-minute song.",
    url: "https://suno.com",
    icon: Music,
    color: "text-purple-300",
    bgColor: "bg-purple-650/10 border-purple-500/20",
  },
  {
    id: "runway",
    name: "Runway Gen-2",
    tag: "Video Gen",
    description: "Text-to-video and image-to-video generation.",
    guide: "Best for filmmakers, animators, and content creators. Generates high-quality cinematic clips from text prompts or static reference photos.",
    url: "https://runwayml.com",
    icon: Video,
    color: "text-red-400",
    bgColor: "bg-red-500/10 border-red-500/20",
  },
  {
    id: "heygen",
    name: "HeyGen",
    tag: "Video Avatar",
    description: "AI spokesperson video generator for product demos.",
    guide: "Best for corporate training, sales, and marketing. Turn scripts into professional spokesperson videos with realistic digital human avatars.",
    url: "https://heygen.com",
    icon: Tv,
    color: "text-orange-355 text-amber-500",
    bgColor: "bg-amber-600/10 border-amber-600/20",
  },
  {
    id: "perplexity",
    name: "Perplexity",
    tag: "AI Search",
    description: "Conversational answer engine with direct source citations.",
    guide: "Best for web research and fact-checking. It searches the internet in real time and compiles detailed answers with clear inline reference links.",
    url: "https://perplexity.ai",
    icon: Search,
    color: "text-teal-350 text-emerald-400",
    bgColor: "bg-emerald-500/10 border-emerald-500/20",
  },
  {
    id: "phind",
    name: "Phind",
    tag: "Dev Search",
    description: "AI search engine optimized for developer queries.",
    guide: "Best for coding syntax, API changes, and programming questions. It scans documentation and GitHub repos to write exact, copy-pasteable code answers.",
    url: "https://phind.com",
    icon: Globe,
    color: "text-blue-400",
    bgColor: "bg-blue-500/10 border-blue-500/20",
  },
  {
    id: "julius",
    name: "Julius AI",
    tag: "Data Science",
    description: "AI analyst that writes python code to graph data.",
    guide: "Best for researchers and students. Upload spreadsheets or CSVs, and Julius will write Python code, generate charts, and run regressions automatically.",
    url: "https://julius.ai",
    icon: BarChart3,
    color: "text-green-400",
    bgColor: "bg-green-500/10 border-green-500/20",
  },
  {
    id: "copilot",
    name: "GitHub Copilot",
    tag: "Autocomplete",
    description: "AI programmer assistant inside your editor autocomplete.",
    guide: "Best for day-to-day coding productivity. Suggests lines of code or entire functions inside VS Code, JetBrains, and other popular IDEs.",
    url: "https://github.com/features/copilot",
    icon: Code2,
    color: "text-indigo-400",
    bgColor: "bg-indigo-500/10 border-indigo-500/20",
  },
  {
    id: "replit",
    name: "Replit Agent",
    tag: "Autopilot",
    description: "Autonomously build and deploy full stack web projects.",
    guide: "Best for quick hackathons. Type a prompt describing a web app, and the agent writes code, configures the database, and deploys it instantly on Replit.",
    url: "https://replit.com",
    icon: Box,
    color: "text-rose-500",
    bgColor: "bg-rose-500/10 border-rose-500/20",
  },
  {
    id: "gamma",
    name: "Gamma App",
    tag: "Presentation",
    description: "Generate slide decks and documents from text notes.",
    guide: "Best for students and business managers. Type your topic or paste raw notes, and Gamma designs structured slide decks with modern themes and templates.",
    url: "https://gamma.app",
    icon: Presentation,
    color: "text-pink-400",
    bgColor: "bg-pink-500/10 border-pink-500/20",
  },
  {
    id: "jasper",
    name: "Jasper AI",
    tag: "Copywriting",
    description: "AI writing assistant for blog posts and marketing copy.",
    guide: "Best for content creators and copywriters. Offers templates for email campaigns, SEO blogs, social media posts, and advertising copy.",
    url: "https://jasper.ai",
    icon: PenTool,
    color: "text-amber-500",
    bgColor: "bg-amber-500/10 border-amber-500/20",
  },
  {
    id: "descript",
    name: "Descript",
    tag: "Video Editor",
    description: "Edit audio and video clips by editing text transcripts.",
    guide: "Best for podcasters and video creators. Transcribes audio, allowing you to edit or delete video frames by simply deleting text from the transcript.",
    url: "https://descript.com",
    icon: Mic,
    color: "text-sky-400",
    bgColor: "bg-sky-500/10 border-sky-500/20",
  },
  {
    id: "synthesia",
    name: "Synthesia",
    tag: "Video Avatar",
    description: "Convert presentation text transcripts to video presentations.",
    guide: "Best for training and localized product pitches. Enter scripts and select from 140+ avatars to generate professional, multi-lingual tutorial videos.",
    url: "https://synthesia.io",
    icon: Tv,
    color: "text-violet-400",
    bgColor: "bg-violet-500/10 border-violet-500/20",
  },
  {
    id: "dalle",
    name: "DALL-E 3",
    tag: "Creative Gen",
    description: "OpenAI's precise text-to-image generator.",
    guide: "Best for custom UI icons, precise prompt adherence, and illustration assets. Integrated directly within ChatGPT Plus.",
    url: "https://openai.com/dall-e-3",
    icon: Image,
    color: "text-rose-400",
    bgColor: "bg-rose-500/10 border-rose-500/20",
  },
]

// Helper to convert File to Base64
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = () => {
      const base64String = (reader.result as string).split(",")[1]
      resolve(base64String)
    }
    reader.onerror = (error) => reject(error)
  })
}

// Helper to provide curated topic fallbacks when Unsplash API is blocked/timed out
const getFallbackImage = (mainTopic: string): string => {
  const topic = mainTopic.toLowerCase().trim()
  if (topic.includes("taj mahal") || topic.includes("agra") || topic.includes("mahal")) {
    return "https://images.unsplash.com/photo-1548013146-72479768bada?w=500&auto=format&fit=crop"
  }
  if (topic.includes("india")) {
    return "https://images.unsplash.com/photo-1548013146-72479768bada?w=500&auto=format&fit=crop"
  }
  if (topic.includes("machine learning") || topic.includes("ai") || topic.includes("neural") || topic.includes("intelligence")) {
    return "https://images.unsplash.com/photo-1527474305487-b87b222841cc?w=500&auto=format&fit=crop"
  }
  if (topic.includes("coding") || topic.includes("program") || topic.includes("javascript") || topic.includes("web") || topic.includes("software") || topic.includes("development")) {
    return "https://images.unsplash.com/photo-1618401471353-b98aedd07871?w=500&auto=format&fit=crop"
  }
  if (topic.includes("react") || topic.includes("next.js")) {
    return "https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=500&auto=format&fit=crop"
  }
  if (topic.includes("physics") || topic.includes("quantum") || topic.includes("mechanic")) {
    return "https://images.unsplash.com/photo-1607988795691-3d0147b43231?w=500&auto=format&fit=crop"
  }
  if (topic.includes("math") || topic.includes("calculus") || topic.includes("integral") || topic.includes("algebra")) {
    return "https://images.unsplash.com/photo-1509228468518-180dd4864904?w=500&auto=format&fit=crop"
  }
  if (topic.includes("science") || topic.includes("chemistry") || topic.includes("biology")) {
    return "https://images.unsplash.com/photo-1532094349884-543bc11b234d?w=500&auto=format&fit=crop"
  }
  return "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=500&auto=format&fit=crop"
}

// Custom parser to format simple markdown strings into JSX
const parseMarkdown = (text: string) => {
  if (!text) return null
  
  const lines = text.split("\n")
  return (
    <div className="space-y-2.5">
      {lines.map((line, idx) => {
        let formatted = line.trim()
        if (!formatted) return <div key={idx} className="h-2" />

        // Check if it's a list item
        const isListItem = formatted.startsWith("- ") || formatted.startsWith("• ") || formatted.startsWith("* ")
        if (isListItem) {
          formatted = formatted.substring(2)
        }

        // Handle bold markers (**text** -> strong)
        const boldRegex = /\*\*(.*?)\*\*/g
        const parts = []
        let lastIndex = 0
        let match

        while ((match = boldRegex.exec(formatted)) !== null) {
          // Add normal text before match
          if (match.index > lastIndex) {
            parts.push(formatted.substring(lastIndex, match.index))
          }
          // Add bold text styled in purple
          parts.push(
            <strong key={match.index} className="text-purple-400 font-bold">
              {match[1]}
            </strong>
          )
          lastIndex = boldRegex.lastIndex
        }
        
        if (lastIndex < formatted.length) {
          parts.push(formatted.substring(lastIndex))
        }

        const finalContent = parts.length > 0 ? parts : formatted

        if (isListItem) {
          return (
            <div key={idx} className="flex items-start gap-2.5 text-white/85 leading-relaxed text-[11px]">
              <span className="text-purple-400 mt-1.5 h-1.5 w-1.5 rounded-full bg-purple-400 flex-shrink-0" />
              <span>{finalContent}</span>
            </div>
          )
        }

        return (
          <p key={idx} className="text-white/80 leading-relaxed text-[11px]">
            {finalContent}
          </p>
        )
      })}
    </div>
  )
}

export default function AIStudyBuddy({ isTeacher = false }: AIStudyBuddyProps) {
  const [selectedTool, setSelectedTool] = useState<ToolItem>(aiTools[0])
  const [isToolsOpen, setIsToolsOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [fileUploaded, setFileUploaded] = useState(false)
  const [fileName, setFileName] = useState("")
  const [fileSize, setFileSize] = useState("")
  const [fileBase64, setFileBase64] = useState("")
  const [fileMimeType, setFileMimeType] = useState("")

  // AI Content States
  const [summary, setSummary] = useState<string>("")
  const [concepts, setConcepts] = useState<Concept[]>([])
  
  // Chat States
  const [messages, setMessages] = useState<Array<{ sender: "user" | "ai"; text: string }>>([
    { sender: "ai", text: "Hi! Ask me anything about your uploaded study notes." },
  ])
  const [input, setInput] = useState("")
  const [sendingChat, setSendingChat] = useState(false)
  
  const fileInputRef = useRef<HTMLInputElement>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)

  // Auto scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // Fetch Unsplash Image with mainTopic context anchoring
  const fetchUnsplashImage = async (query: string, mainTopic: string): Promise<string> => {
    const unsplashKey = process.env.NEXT_PUBLIC_UNSPLASH_CLIENT_ID
    if (!unsplashKey || unsplashKey.startsWith("your_")) return ""
    try {
      const combinedQuery = `${mainTopic} ${query}`.trim()
      // 1. Try combined query (context-anchored)
      let res = await fetch(
        `https://api.unsplash.com/search/photos?query=${encodeURIComponent(combinedQuery)}&client_id=${unsplashKey}&per_page=1`
      )
      let data = await res.json()
      if (data.results && data.results.length > 0) {
        return data.results[0].urls.regular
      }
      
      // 2. Fallback: Try just the mainTopic (highly specific subject)
      res = await fetch(
        `https://api.unsplash.com/search/photos?query=${encodeURIComponent(mainTopic)}&client_id=${unsplashKey}&per_page=1`
      )
      data = await res.json()
      if (data.results && data.results.length > 0) {
        return data.results[0].urls.regular
      }

      // 3. Fallback: Clean the query to get first 2 words
      const words = query.split(/\s+/).filter(w => w.length > 2)
      if (words.length > 0) {
        const simplified = words.slice(0, 2).join(" ")
        res = await fetch(
          `https://api.unsplash.com/search/photos?query=${encodeURIComponent(simplified)}&client_id=${unsplashKey}&per_page=1`
        )
        data = await res.json()
        if (data.results && data.results.length > 0) {
          return data.results[0].urls.regular
        }
      }
      
      return ""
    } catch (e) {
      console.error("Unsplash error:", e)
      return ""
    }
  }

  // Fetch YouTube Videos
  const fetchYouTubeVideos = async (query: string): Promise<YTVideo[]> => {
    const youtubeKey = process.env.NEXT_PUBLIC_YOUTUBE_API_KEY
    if (!youtubeKey || youtubeKey.startsWith("your_")) return []
    try {
      const res = await fetch(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=2&q=${encodeURIComponent(query + " tutorial")}&key=${youtubeKey}&type=video`
      )
      const data = await res.json()
      return (data.items || []).map((item: any) => ({
        id: item.id.videoId,
        title: item.snippet.title,
        thumbnail: item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url || "",
      }))
    } catch (e) {
      console.error("YouTube search error:", e)
      return []
    }
  }

  // Process File and generate summary via Gemini
  const processFileContent = async (file: File) => {
    setUploading(true)
    
    // Mock Data Fallback Function
    const loadMockData = (warningMessage?: string) => {
      setSummary(
        (warningMessage ? `⚠️ ${warningMessage}\n\n` : "") +
        `Here is a summary of the uploaded document "${file.name}":\n\n` +
        `• **Core Subject**: Focuses on key development tools and advanced coding paradigms.\n` +
        `• **Key Takeaway 1**: Automation of code generation enables rapid prototyping.\n` +
        `• **Key Takeaway 2**: Natural language interfaces allow non-developers to create applications.\n` +
        `• **Key Takeaway 3**: Browser-hosted development sandboxes reduce friction.`
      )
      setConcepts([
        {
          title: "Agentic AI Coding",
          desc: "AI systems that act autonomously to plan, debug, and execute code changes in real repositories.",
          imgPrompt: "Artificial Intelligence coding",
          imageUrl: getFallbackImage("coding"),
          videos: [
            {
              id: "dQw4w9WgXcQ",
              title: "Agentic AI Explained in 5 Minutes",
              thumbnail: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=120&auto=format&fit=crop"
            }
          ]
        },
        {
          title: "Prompt-driven UI design",
          desc: "Creating layout systems and user interfaces purely by describing the desired visual structure.",
          imgPrompt: "Abstract UI design wireframe",
          imageUrl: "https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?w=500&auto=format&fit=crop",
          videos: [
            {
              id: "dQw4w9WgXcQ",
              title: "How to Build Modern UI with AI Prompting",
              thumbnail: "https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?w=120&auto=format&fit=crop"
            }
          ]
        },
      ])
      setMessages([
        { sender: "ai", text: `I've finished analyzing "${file.name}"! ${warningMessage ? `(Note: Using mock data due to API error: ${warningMessage})` : ""} I've created a clean summary and bulleted the core concepts on the left. Feel free to ask me any specific doubts or questions about this material here!` }
      ])
      setUploading(false)
      setFileUploaded(true)
    }

    try {
      const base64 = await fileToBase64(file)
      setFileBase64(base64)
      setFileMimeType(file.type || "application/pdf")

      const geminiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY
      if (!geminiKey || geminiKey.startsWith("your_")) {
        loadMockData("Gemini API key is not configured in .env.local.")
        return
      }

      // Build Gemini Prompt for Summary and Concepts
      const prompt = `You are an AI Study Buddy. Analyze the uploaded document carefully and thoroughly. Please generate a structured study response in JSON format. Do not write any markdown wrappers around JSON, just pure raw JSON string. The JSON should have this structure:
{
  "mainTopic": "Overall subject of the document in 1-2 words (e.g. 'Taj Mahal')",
  "summary": "markdown format string summarizing the notes briefly with bullet points",
  "concepts": [
    { "title": "Concept Name", "desc": "Brief explanation", "imgPrompt": "A single extremely simple keyword or name (e.g. 'marble', 'construction') that represents this concept for searching on Unsplash. Keep it under 2 words. Do not use full phrases or sentences." }
  ]
}`;

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{
              parts: [
                { text: prompt },
                {
                  inlineData: {
                    mimeType: file.type || "application/pdf",
                    data: base64
                  }
                }
              ]
            }],
            generationConfig: { responseMimeType: "application/json" }
          }),
        }
      )

      if (!response.ok) {
        const errorText = await response.text()
        console.error("Gemini API error status:", response.status, errorText)
        loadMockData(`Gemini API failed with status ${response.status}. Please check your API key.`)
        return
      }

      const data = await response.json()
      const rawText = data.candidates[0].content.parts[0].text
      const result = JSON.parse(rawText)
      
      const mainTopic = result.mainTopic || "study notes"
      const parsedConcepts = result.concepts || []
      
      // Enrich concepts with Unsplash images and YouTube videos in parallel
      const enrichedConcepts = await Promise.all(
        parsedConcepts.map(async (concept: any) => {
          const [imgUrl, videosList] = await Promise.all([
            fetchUnsplashImage(concept.imgPrompt || concept.title, mainTopic),
            fetchYouTubeVideos(concept.title + " " + mainTopic)
          ])
          return {
            ...concept,
            imageUrl: imgUrl || getFallbackImage(mainTopic),
            videos: videosList
          }
        })
      )

      setSummary(result.summary)
      setConcepts(enrichedConcepts)
      setMessages([
        { sender: "ai", text: `I've finished analyzing "${file.name}"! I've created a clean summary and bulleted the core concepts on the left. Feel free to ask me any specific doubts or questions about this material here!` }
      ])
      setFileUploaded(true)
    } catch (error: any) {
      console.error("Gemini analysis error:", error)
      loadMockData(error.message || "Failed to parse PDF using Gemini.")
    } finally {
      setUploading(false)
    }
  }

  // Handle file select
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setFileName(file.name)
    const size = (file.size / 1024).toFixed(1) + " KB"
    setFileSize(size)
    await processFileContent(file)
  }

  // Handle Drag & Drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (!file) return

    setFileName(file.name)
    const size = (file.size / 1024).toFixed(1) + " KB"
    setFileSize(size)
    await processFileContent(file)
  }

  // Send message in Doubt Chat
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || sendingChat) return

    const userMsg = input.trim()
    setInput("")
    setMessages((prev) => [...prev, { sender: "user", text: userMsg }])
    setSendingChat(true)

    const geminiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY
    if (!geminiKey || geminiKey.startsWith("your_")) {
      // Mock Response
      setTimeout(() => {
        setMessages((prev) => [
          ...prev,
          { sender: "ai", text: `This is a mock study assistant response to your question: "${userMsg}". Set up a real Gemini API Key to enable live answers!` },
        ])
        setSendingChat(false)
      }, 1200)
      return
    }

    try {
      const systemInstruction = `You are an expert AI Study Buddy and tutor. The student has uploaded a study file named "${fileName}". Please answer their question clearly, engagingly, and extremely concisely.
Instructions for your response:
1. Keep the answer extremely brief (maximum of 2-3 short bullet points, or 1-2 sentences).
2. Bold the key terms using markdown **text** style so they stand out and can be highlighted.
3. Prioritize information from the uploaded document. If not found in the document, explain it briefly using your tutor knowledge, and add "(Added outside context)" next to those points.
4. Do not output conversational filler. Get straight to the explanation.`

      const parts = [
        { text: systemInstruction },
        { text: `Student's question: ${userMsg}` }
      ]

      if (fileBase64 && fileMimeType) {
        parts.push({
          inlineData: {
            mimeType: fileMimeType,
            data: fileBase64
          }
        } as any)
      }
      
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts }],
          }),
        }
      )

      const data = await response.json()
      const responseText = data.candidates[0].content.parts[0].text
      setMessages((prev) => [...prev, { sender: "ai", text: responseText }])
    } catch (error) {
      console.error("Chat error:", error)
      setMessages((prev) => [
        ...prev,
        { sender: "ai", text: "Sorry, I had trouble processing that request. Please try again." },
      ])
    } finally {
      setSendingChat(false)
    }
  }

  return (
    <div className="relative flex flex-row items-stretch w-full h-[640px] max-h-[640px] gap-6 animate-fadeIn">
      
      {/* ─── FLOATING COLLAPSIBLE TOOLS DRAWER (PREMIUM DESIGN) ─── */}
      <div className="flex flex-row items-stretch z-30">
        {/* Extreme Left Tab Trigger */}
        <button
          type="button"
          onClick={() => setIsToolsOpen(!isToolsOpen)}
          className={`flex flex-col items-center justify-center gap-3 px-3 py-7 bg-[#161616]/80 backdrop-blur-md hover:bg-purple-600/10 text-white rounded-r-xl transition-all cursor-pointer shadow-lg hover:shadow-purple-500/10 self-center border border-white/5 hover:border-purple-500/20 active:scale-95 ${
            isToolsOpen ? "rounded-l-none" : "rounded-xl border-l-2 border-l-purple-500"
          }`}
        >
          <Settings className="h-4 w-4 animate-spin-slow text-purple-400" />
          <span className="text-[9px] font-extrabold uppercase tracking-widest [writing-mode:vertical-lr] rotate-180 text-white/80 group-hover:text-purple-300">
            {isToolsOpen ? "Close Tools" : "Tools"}
          </span>
        </button>

        {/* Sliding Tools Panel */}
        <div
          className={`bg-[#121212]/95 backdrop-blur-md border border-white/5 shadow-2xl rounded-r-2xl transition-all duration-300 ease-in-out overflow-hidden flex flex-col ${
            isToolsOpen ? "w-[320px] p-5 opacity-100 ml-1" : "w-0 p-0 opacity-0 pointer-events-none"
          }`}
        >
          <div className="flex items-center justify-between border-b border-white/5 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-purple-400 animate-pulse" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-white">AI Toolbox (24)</h2>
            </div>
            <button
              type="button"
              onClick={() => setIsToolsOpen(false)}
              className="text-white/40 hover:text-white p-1 hover:bg-white/5 rounded-lg transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-3 flex-1 overflow-y-auto pr-1 scrollbar-thin">
            {aiTools.map((tool) => {
              const ToolIcon = tool.icon
              return (
                <button
                  key={tool.id}
                  type="button"
                  onClick={() => setSelectedTool(tool)}
                  className={`w-full text-left p-3 rounded-xl border transition-all cursor-pointer flex items-center gap-3.5 group ${
                    selectedTool.id === tool.id
                      ? "bg-[#1d1d1d] border-purple-500 text-white shadow-md shadow-purple-500/5"
                      : "bg-[#1d1d1d]/40 border-white/5 text-white/60 hover:bg-[#1d1d1d] hover:text-white hover:border-white/10"
                  }`}
                >
                  <div className={`p-2 rounded-xl transition-all border ${tool.bgColor}`}>
                    <ToolIcon className={`h-3.5 w-3.5 ${tool.color} group-hover:scale-110 transition-transform`} />
                  </div>
                  <div className="space-y-0.5 flex-1 overflow-hidden">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold truncate">{tool.name}</span>
                      <span className="inline-flex items-center rounded-full bg-white/5 border border-white/5 px-1.5 py-0.5 text-[7px] text-white/40 uppercase font-semibold">
                        {tool.tag.split(" ")[0]}
                      </span>
                    </div>
                    <p className="text-[9px] text-white/35 truncate max-w-[155px]">
                      {tool.description}
                    </p>
                  </div>
                </button>
              )
            })}
          </div>

          {selectedTool && (
            <div className="p-4 bg-purple-500/[0.03] border border-purple-500/10 rounded-xl space-y-2 mt-4 shadow-inner">
              <div className="flex items-center justify-between border-b border-purple-500/10 pb-1.5">
                <span className="text-[9px] uppercase font-extrabold text-purple-400 tracking-wider flex items-center gap-1">
                  <Brain className="h-2.5 w-2.5" /> Guide
                </span>
                <a
                  href={selectedTool.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-[9px] text-purple-400 hover:text-purple-300 font-bold transition-colors"
                >
                  Open <ExternalLink className="h-2.5 w-2.5" />
                </a>
              </div>
              <h3 className="text-xs font-extrabold text-white">{selectedTool.name}</h3>
              <p className="text-[10px] text-white/50 leading-relaxed font-medium">
                {selectedTool.guide}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ─── MAIN WORKSPACE: SPLIT SCREEN LAYOUT ─── */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6 h-full max-h-full">
        
        {/* ─── LEFT PANEL: DOCUMENT SUMMARY & TOPIC EXPLORER ─── */}
        <div className="flex flex-col bg-[#111] border border-white/5 rounded-2xl overflow-hidden h-full">
          {!fileUploaded ? (
            <div
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              className="flex-1 border-2 border-dashed border-white/5 rounded-2xl m-4 flex flex-col items-center justify-center gap-4 hover:border-purple-500/20 transition-all group"
            >
              {uploading ? (
                <div className="space-y-4 text-center">
                  <Loader2 className="h-10 w-10 animate-spin text-purple-500 mx-auto" />
                  <div>
                    <h3 className="text-sm font-bold text-white">Analyzing document...</h3>
                    <p className="text-xs text-white/40 mt-1">Extracting topics using Agentic AI</p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="h-14 w-14 rounded-full bg-purple-500/5 border border-purple-500/10 flex items-center justify-center text-purple-400 group-hover:scale-110 transition-all">
                    <UploadCloud className="h-6 w-6" />
                  </div>
                  <div className="text-center">
                    <h3 className="text-sm font-bold text-white">Upload Slides, PPTs, PDFs, or Text</h3>
                    <p className="text-xs text-white/40 mt-1">
                      Drag study file here or{" "}
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="text-purple-400 font-semibold hover:underline cursor-pointer"
                      >
                        browse
                      </button>
                    </p>
                  </div>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    className="hidden"
                    accept=".txt,.pdf,.docx,.doc,.pptx,.ppt"
                  />
                  <div className="flex gap-3 text-[9px] text-white/20 font-bold uppercase mt-2">
                    <span>PDF</span>
                    <span>•</span>
                    <span>PPTX</span>
                    <span>•</span>
                    <span>DOCX</span>
                    <span>•</span>
                    <span>TXT</span>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* File Info Bar */}
              <div className="px-6 py-4 border-b border-white/5 bg-black/20 flex items-center justify-between">
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400 flex-shrink-0">
                    <FileText className="h-4 w-4" />
                  </div>
                  <div className="overflow-hidden">
                    <h3 className="text-xs font-bold text-white truncate max-w-[150px]">{fileName}</h3>
                    <p className="text-[10px] text-white/40 mt-0.5">{fileSize}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-2.5 py-1.5 rounded-lg border border-white/5 bg-white/[0.02] text-[10px] font-bold text-white/70 hover:bg-white/5 transition-all cursor-pointer"
                  >
                    Upload New
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFileUploaded(false)
                      setFileName("")
                      setFileSize("")
                      setFileBase64("")
                      setFileMimeType("")
                      setMessages([{ sender: "ai", text: "Hi! Ask me anything about your uploaded study notes." }])
                    }}
                    className="px-2.5 py-1.5 rounded-lg border border-red-500/20 bg-red-500/10 text-[10px] font-bold text-red-400 hover:bg-red-500/20 transition-all cursor-pointer flex items-center gap-1"
                  >
                    <Trash2 className="h-3 w-3" />
                    Delete
                  </button>
                </div>
              </div>

              {/* Scrollable Summary & Topics View */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin">
                
                {/* Overview Summary */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 border-b border-white/5 pb-2">
                    <BookOpen className="h-4 w-4 text-purple-400" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-white">Overview Summary</h3>
                  </div>
                  <div className="p-5 bg-white/[0.02] border border-white/[0.05] rounded-xl font-sans shadow-inner space-y-2">
                    {parseMarkdown(summary)}
                  </div>
                </div>

                {/* Topics Explained */}
                {concepts.length > 0 && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 border-b border-white/5 pb-2">
                      <Sparkles className="h-4 w-4 text-purple-400" />
                      <h3 className="text-xs font-bold uppercase tracking-wider text-white">Topics Explained</h3>
                    </div>

                    <div className="space-y-5">
                      {concepts.map((concept, idx) => (
                        <div
                          key={idx}
                          className="bg-[#181818] border border-white/5 rounded-xl p-4 space-y-3 hover:border-purple-500/10 transition-colors"
                        >
                          <div className="flex items-center justify-between border-b border-white/5 pb-2">
                            <h4 className="text-xs font-bold text-purple-300">{concept.title}</h4>
                            <span className="text-[8px] bg-purple-500/10 px-2 py-0.5 rounded text-purple-400 font-semibold uppercase">
                              Concept {idx + 1}
                            </span>
                          </div>

                          {/* YouTube Learning Videos (UPPER SECTION) */}
                          {concept.videos && concept.videos.length > 0 && (
                            <div className="space-y-2">
                              <span className="text-[9px] uppercase font-bold text-white/30 tracking-wider flex items-center gap-1.5">
                                <Video className="h-3 w-3" /> Recommended Video Tutorials
                              </span>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {concept.videos.map((vid) => (
                                  <a
                                    key={vid.id}
                                    href={`https://www.youtube.com/watch?v=${vid.id}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="flex items-center gap-2 p-2 bg-black/20 hover:bg-black/40 border border-white/5 rounded-lg group transition-all"
                                  >
                                    <div className="relative h-10 w-16 bg-neutral-900 rounded overflow-hidden flex-shrink-0">
                                      {/* eslint-disable-next-line @next/next/no-img-element */}
                                      <img src={vid.thumbnail} alt={vid.title} className="object-cover w-full h-full" />
                                    </div>
                                    <span className="text-[10px] text-white/70 group-hover:text-purple-400 font-medium line-clamp-2 leading-snug">
                                      {vid.title}
                                    </span>
                                  </a>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          <p className="text-[11px] text-white/60 leading-relaxed font-sans mt-2 pt-1">
                            {concept.desc}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ─── RIGHT PANEL: DOUBT CHAT ─── */}
        <div className="flex flex-col bg-[#111] border border-white/5 rounded-2xl overflow-hidden h-full">
          {/* Header */}
          <div className="px-6 py-4.5 border-b border-white/5 bg-black/20 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <HelpCircle className="h-4 w-4 text-purple-400" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-white">Doubt Chat</h2>
            </div>
            <span className="text-[9px] font-bold text-purple-400 tracking-wider uppercase bg-purple-500/10 px-2.5 py-1 rounded-full border border-purple-500/15">
              Document AI Active
            </span>
          </div>

          {/* Chat area */}
          <div className="flex-1 flex flex-col p-6 overflow-hidden bg-[#131313]/30">
            {/* Bubble List */}
            <div className="flex-1 space-y-4 overflow-y-auto pb-4 pr-1 scrollbar-thin">
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-xl px-4 py-2.5 text-xs leading-relaxed ${
                      msg.sender === "user"
                        ? "bg-purple-600 text-white shadow-md shadow-purple-600/10"
                        : "bg-[#1d1d1d] text-white/80 border border-white/5 shadow-inner"
                    }`}
                  >
                    {msg.sender === "ai" ? parseMarkdown(msg.text) : msg.text}
                  </div>
                </div>
              ))}
              {sendingChat && (
                <div className="flex justify-start">
                  <div className="bg-[#1d1d1d] text-white/40 border border-white/5 rounded-xl px-4 py-2.5 text-xs flex items-center gap-2 animate-pulse">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-purple-400" />
                    Analyzing reference details...
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input Bar */}
            <form onSubmit={handleSendMessage} className="flex gap-2 pt-4 border-t border-white/5">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask doubt about notes..."
                disabled={sendingChat || !fileUploaded}
                className="flex-1 bg-black/30 border border-white/5 rounded-xl px-4 py-3 text-xs text-white placeholder-white/25 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/20 transition-all disabled:opacity-40"
              />
              <button
                type="submit"
                disabled={!input.trim() || sendingChat || !fileUploaded}
                className="p-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl transition-all shadow-md shadow-purple-500/10 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>

      </div>
    </div>
  )
}
