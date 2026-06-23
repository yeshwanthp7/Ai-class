"use client"

import React, { useState, useEffect, useRef } from "react"
import Link from "next/link"
import Image from "next/image"
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Volume2,
  Users,
  Settings,
  Brain,
  User as UserIcon,
  AlertCircle,
  X,
  Play,
  Pause,
  TrendingUp,
  MessageSquare,
  Hand,
  CornerDownRight,
  Info,
  Sparkles,
  Tv,
  ScreenShare,
  Presentation,
  PenTool,
  Radio,
  Clock,
  LogOut,
  Maximize2
} from "lucide-react"

import { Session, Student, endSession } from "@/lib/session-service"

interface ClassroomViewProps {
  sessionCode: string
  session: Session
  studentsList: Student[]
  isTeacher: boolean
  studentId: string | null
  studentName: string | null
}

interface MockContent {
  type: "SLIDE" | "IMAGE" | "VIDEO"
  title: string
  caption: string
  url?: string
}

const MOCK_CONTENT_ITEMS: MockContent[] = [
  { 
    type: "SLIDE", 
    title: "1. The First Law of Thermodynamics", 
    caption: "Energy cannot be created or destroyed, only transformed from one form to another. ΔU = Q - W",
  },
  { 
    type: "IMAGE", 
    title: "2. The Carnot Cycle Engine Schematic", 
    caption: "Figure 2.1: Showing Heat input (Qh) from Hot reservoir, Work output (W), and Heat output (Qc) to Cold reservoir.",
  },
  { 
    type: "VIDEO", 
    title: "3. Entropy & The Second Law Explained", 
    caption: "Short video demonstrating molecular randomness, disorder, and irreversible thermodynamic processes.",
    url: "https://www.youtube.com/embed/kYWz52_h6BY" // Educational video about entropy
  },
  { 
    type: "SLIDE", 
    title: "4. Absolute Zero & The Third Law", 
    caption: "As temperature approaches absolute zero (0 Kelvin), the entropy of a pure crystalline substance approaches zero.",
  }
]

const AI_LOBBY_SUBTITLES = [
  "Welcome back to ClassAI. Today, we are studying Thermodynamics.",
  "Let's review the First Law: Energy cannot be created or destroyed, only transformed.",
  "Look at the schematic showing the Carnot Cycle model on your screen.",
  "This is a theoretical engine that yields maximum thermal efficiency.",
  "Entropy, represented by S, is a measure of molecular randomness or disorder.",
  "As we proceed, notice how efficiency depends strictly on temperature reservoirs.",
  "That completes our core outline. Let's look at absolute zero boundaries."
]

export default function ClassroomView({
  sessionCode,
  session,
  studentsList,
  isTeacher,
  studentId,
  studentName,
}: ClassroomViewProps) {

  // Media toggles
  const [micOn, setMicOn] = useState(true)
  const [videoOn, setVideoOn] = useState(true)
  const [handRaised, setHandRaised] = useState(false)
  const [chatOpen, setChatOpen] = useState(true)
  const [isRecording, setIsRecording] = useState(false)
  const [screenSharing, setScreenSharing] = useState(false)
  const [whiteboardActive, setWhiteboardActive] = useState(false)
  const [hasEntered, setHasEntered] = useState(false)

  // Timer & Topic Progress
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [activeTopicIdx, setActiveTopicIdx] = useState(0)
  const [subIndex, setSubIndex] = useState(0)

  // Mode Overrides (AI vs Paused vs Human)
  const [teachingMode, setTeachingMode] = useState<"AI" | "Paused" | "Human">(
    session.teachingMode === "AI" ? "AI" : "Human"
  )

  // AI suggestions in Human teacher mode
  const [aiSuggestions, setAiSuggestions] = useState<MockContent | null>({
    type: "IMAGE",
    title: "AI suggests showing: Carnot Cycle schematic diagram",
    caption: "Visual diagram demonstrating heat flow in engine pistons."
  })

  // Chat/Doubt System
  const [chatInput, setChatInput] = useState("")
  const [messages, setMessages] = useState<Array<{
    id: string
    sender: string
    text: string
    time: string
    isAI: boolean
  }>>([
    { id: "1", sender: "Professor AI", text: "Welcome to today's physics session. Feel free to type any doubts here.", time: "12:00 PM", isAI: true },
  ])

  // Toasts
  const [toasts, setToasts] = useState<Array<{ id: string; text: string; icon?: React.ReactNode }>>([])

  // End Session flow
  const [showEndModal, setShowEndModal] = useState(false)
  const [endCountdown, setEndCountdown] = useState<number | null>(null)

  // Dynamic students list for attention simulation
  const [dynamicStudents, setDynamicStudents] = useState<Array<Student & { focusColor: string; attentionState: "focused" | "distracted" | "offline"; isMuted: boolean }>>([])
  const [classFocusAvg, setClassFocusAvg] = useState(87)

  const chatBottomRef = useRef<HTMLDivElement>(null)

  // Autoplay Web Audio API start chime
  const playChime = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
      const osc1 = ctx.createOscillator()
      const osc2 = ctx.createOscillator()
      const gainNode = ctx.createGain()
      
      osc1.type = "sine"
      osc1.frequency.setValueAtTime(587.33, ctx.currentTime) // D5
      osc1.frequency.exponentialRampToValueAtTime(880.00, ctx.currentTime + 0.3) // A5
      
      osc2.type = "sine"
      osc2.frequency.setValueAtTime(440.00, ctx.currentTime) // A4
      osc2.frequency.exponentialRampToValueAtTime(659.25, ctx.currentTime + 0.3) // E5
      
      gainNode.gain.setValueAtTime(0.20, ctx.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2)
      
      osc1.connect(gainNode)
      osc2.connect(gainNode)
      gainNode.connect(ctx.destination)
      
      osc1.start()
      osc2.start()
      osc1.stop(ctx.currentTime + 1.2)
      osc2.stop(ctx.currentTime + 1.2)
    } catch (e) {
      console.warn("AudioContext block:", e)
    }
  }

  // 1. Timer ticking
  useEffect(() => {
    if (!hasEntered) return
    const interval = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1)
    }, 1000)
    return () => clearInterval(interval)
  }, [hasEntered])

  // 2. AI Subtitle & Topic progression (every 7s, unless paused or in human mode)
  useEffect(() => {
    if (!hasEntered || teachingMode !== "AI") return
    const interval = setInterval(() => {
      setSubIndex((prev) => {
        const next = (prev + 1) % AI_LOBBY_SUBTITLES.length
        
        // Topic transition trigger
        if (next === 2 || next === 4 || next === 6) {
          const nextTopic = (activeTopicIdx + 1) % MOCK_CONTENT_ITEMS.length
          setActiveTopicIdx(nextTopic)
          addToast("Moving to next topic")
        }
        return next
      })
    }, 7000)
    return () => clearInterval(interval)
  }, [hasEntered, teachingMode, activeTopicIdx])

  // 3. Populate and update student focus telemetry
  useEffect(() => {
    if (!hasEntered) return
    const simulateFocus = () => {
      const updated = studentsList.map((st) => {
        const score = Math.floor(Math.random() * 45) + 55 // 55% - 100%
        let attentionState: "focused" | "distracted" | "offline" = "focused"
        let border = "border-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.35)]"
        
        if (score < 70) {
          attentionState = "distracted"
          border = "border-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.35)]"
        }
        if (score < 60) {
          attentionState = "offline"
          border = "border-rose-500 shadow-[0_0_8px_rgba(239,68,68,0.35)]"
        }

        return {
          ...st,
          engagementScore: score,
          attentionState,
          focusColor: border,
          isMuted: Math.random() > 0.3
        }
      })

      // Ensure at least 8 students in the grid for mock experience
      const MOCK_NAMES = ["Emily R.", "Jacob S.", "Michael C.", "Sophia P.", "Liam K.", "Chloe D.", "Daniel M.", "Olivia W."]
      while (updated.length < 8) {
        const idx = updated.length
        const score = Math.floor(Math.random() * 40) + 60
        let attentionState: "focused" | "distracted" | "offline" = "focused"
        let border = "border-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.35)]"
        
        if (score < 72) {
          attentionState = "distracted"
          border = "border-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.35)]"
        }
        if (score < 60) {
          attentionState = "offline"
          border = "border-rose-500 shadow-[0_0_8px_rgba(239,68,68,0.35)]"
        }

        updated.push({
          id: `mock-st-${idx}`,
          name: MOCK_NAMES[idx % MOCK_NAMES.length],
          joinedAt: null,
          lastActive: null,
          status: "active",
          engagementScore: score,
          attentionState,
          focusColor: border,
          isMuted: true
        })
      }

      setDynamicStudents(updated)

      // Calculate class average
      const avg = Math.floor(updated.reduce((acc, c) => acc + c.engagementScore, 0) / updated.length)
      setClassFocusAvg(avg)

      if (avg < 72) {
        addToast("Class attention dropping", <AlertCircle className="h-4 w-4 text-amber-500" />)
      }
    }

    simulateFocus()
    const interval = setInterval(simulateFocus, 6000)
    return () => clearInterval(interval)
  }, [hasEntered, studentsList])

  // 4. Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "TEXTAREA") {
        return
      }
      const key = e.key.toLowerCase()
      if (key === "m") {
        setMicOn(!micOn)
        addToast(micOn ? "Microphone muted" : "Microphone active")
      } else if (key === "v") {
        setVideoOn(!videoOn)
        addToast(videoOn ? "Camera feed disabled" : "Camera feed enabled")
      } else if (key === "h") {
        setHandRaised(!handRaised)
        if (!handRaised) {
          addToast("You raised your hand ✋")
          // If student, mock toast to teacher
          if (!isTeacher) {
            triggerAudioSpeech(`${studentName || "Student"} raised hand.`)
          }
        }
      } else if (key === "c") {
        setChatOpen(!chatOpen)
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [micOn, videoOn, handRaised, chatOpen, isTeacher, studentName])

  // Scroll chat bottom
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // Toast Manager
  const addToast = (text: string, icon?: React.ReactNode) => {
    const id = Date.now().toString()
    setToasts((prev) => [...prev, { id, text, icon }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 4000)
  }

  // Audio Speech Synthesizer
  const triggerAudioSpeech = (text: string) => {
    try {
      const synth = window.speechSynthesis
      if (synth) {
        const utterance = new SpeechSynthesisUtterance(text)
        utterance.volume = 0.4
        utterance.rate = 1.05
        synth.speak(utterance)
      }
    } catch (e) {
      console.warn("Speech synthesis unavailable.")
    }
  }

  // Handle Doubt submission
  const handleSendDoubt = (e: React.FormEvent) => {
    e.preventDefault()
    if (!chatInput.trim()) return

    const userMsg = {
      id: Date.now().toString(),
      sender: studentName || "You",
      text: chatInput.trim(),
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      isAI: false,
    }

    setMessages((prev) => [...prev, userMsg])
    setChatInput("")

    // Trigger AI doubt resolver flow
    if (teachingMode === "AI") {
      setTeachingMode("Paused")
      addToast("AI paused teaching to answer doubt")
      triggerAudioSpeech("Answering doubt.")

      setTimeout(() => {
        const aiAnswer = {
          id: (Date.now() + 1).toString(),
          sender: "Professor AI",
          text: "That is an excellent doubt! We look at Carnot cycle efficiency as the theoretical limit. Real heat engines always produce entropy, resulting in lesser work extraction.",
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          isAI: true,
        }
        setMessages((prev) => [...prev, aiAnswer])
        
        setTimeout(() => {
          setTeachingMode("AI")
          addToast("AI resumed teaching")
          triggerAudioSpeech("Great question! Now let's continue...")
        }, 1500)
      }, 3000)
    } else {
      // Human mode auto response
      setTimeout(() => {
        const aiAnswer = {
          id: (Date.now() + 1).toString(),
          sender: "Professor AI",
          text: "🤖 [AI Assistant Helper] Suggested explanation: Entropy measures system microstates. Increasing entropy makes thermal work less convertible back into mechanical force.",
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          isAI: true,
        }
        setMessages((prev) => [...prev, aiAnswer])
      }, 2000)
    }
  }

  // Format Elapsed Time
  const formatTimeStr = (sec: number) => {
    const m = Math.floor(sec / 60).toString().padStart(2, "0")
    const s = (sec % 60).toString().padStart(2, "0")
    return `${m}:${s}`
  }

  // Handle End Class
  const confirmEndClass = () => {
    setShowEndModal(false)
    setEndCountdown(5)
    triggerAudioSpeech("That's all for today. Great work everyone!")
  }

  // Countdown timer redirect
  useEffect(() => {
    if (endCountdown === null) return
    if (endCountdown === 0) {
      window.location.href = `/session/${sessionCode}/summary`
      return
    }
    const timer = setTimeout(() => {
      setEndCountdown((c) => (c !== null ? c - 1 : null))
    }, 1000)
    return () => clearTimeout(timer)
  }, [endCountdown, sessionCode])

  const currentContent = MOCK_CONTENT_ITEMS[activeTopicIdx]
  const progressPercent = Math.floor(((activeTopicIdx + 1) / MOCK_CONTENT_ITEMS.length) * 100)

  return (
    <div className="fixed inset-0 bg-[#070708] text-white flex flex-col font-sans antialiased overflow-hidden select-none z-50 h-screen w-screen">
      
      {/* Start Class Overlay to satisfy browser autoplay policy */}
      {!hasEntered && (
        <div className="fixed inset-0 bg-[#0A0A0C] z-[99] flex flex-col items-center justify-center text-center p-6 select-none">
          <div className="space-y-6 max-w-sm mx-auto animate-scaleUp">
            {/* Animated Logo */}
            <div className="h-16 w-16 rounded-2xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-violet-600 flex items-center justify-center border border-purple-400/25 mx-auto shadow-[0_0_30px_rgba(147,51,234,0.3)]">
              <Brain className="h-8 w-8 text-white" />
            </div>
            
            <div className="space-y-2">
              <h2 className="text-xl font-black tracking-tight text-white">Class is ready</h2>
              <p className="text-xs text-white/40 leading-relaxed">
                Connect your audio devices and click below to enter the live session room.
              </p>
            </div>

            <button
              onClick={() => {
                playChime();
                if (teachingMode === "AI") {
                  triggerAudioSpeech("Welcome back to ClassAI. Today, we are studying Thermodynamics.");
                }
                setHasEntered(true);
              }}
              className="w-full py-4 px-6 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-black uppercase tracking-wider transition-all duration-300 shadow-lg shadow-purple-600/20 active:scale-[0.98] cursor-pointer"
            >
              Enter Classroom
            </button>
          </div>
        </div>
      )}

      {/* Waveform Keyframes */}
      <style>{`
        @keyframes waveform {
          0%, 100% { transform: scaleY(0.2); }
          50% { transform: scaleY(1.0); }
        }
        .wv-bar {
          animation: waveform 0.75s ease-in-out infinite;
        }
        .wv-1 { animation-delay: 0.1s; }
        .wv-2 { animation-delay: 0.25s; }
        .wv-3 { animation-delay: 0.05s; }
        .wv-4 { animation-delay: 0.3s; }
        .wv-5 { animation-delay: 0.15s; }
      `}</style>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      ─── TOP BAR (dark #111111) ────────
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <header className="h-16 bg-[#111111] border-b border-white/[0.06] px-6 flex items-center justify-between flex-shrink-0 z-30">
        {/* Left: Logo & Session Title */}
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center border border-purple-400/25">
            <Brain className="h-4.5 w-4.5 text-white" />
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-black tracking-tight text-white leading-none">
              Class<span className="text-purple-400">AI</span>
            </span>
            <span className="text-[10px] text-white/40 font-semibold tracking-wide truncate max-w-[140px] mt-0.5 uppercase">
              {session.title || "Thermodynamics Lab"}
            </span>
          </div>
        </div>

        {/* Center: Topic progress indicator */}
        <div className="flex flex-col items-center gap-1.5 w-80">
          <div className="flex items-center gap-2 text-xs text-white/70 font-medium">
            <span className="text-purple-400 font-bold uppercase text-[9px] tracking-wider">
              Topic {activeTopicIdx + 1} of {MOCK_CONTENT_ITEMS.length}:
            </span>
            <span className="truncate max-w-[160px]">{currentContent.title}</span>
          </div>
          <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
            <div 
              className="h-full bg-purple-500 rounded-full transition-all duration-700 ease-out" 
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Right: Metrics & End session */}
        <div className="flex items-center gap-4 text-xs font-semibold">
          {/* Class Focus */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.02] border border-white/5">
            <span className={`h-2 w-2 rounded-full ${classFocusAvg >= 80 ? "bg-emerald-500" : "bg-amber-400"}`} />
            <span className="text-white/40">Class Focus:</span>
            <span className={classFocusAvg >= 80 ? "text-emerald-400" : "text-amber-400"}>
              {classFocusAvg}%
            </span>
          </div>

          {/* Time & Count */}
          <div className="flex items-center gap-3 bg-white/[0.02] border border-white/5 px-3 py-1.5 rounded-lg">
            <div className="flex items-center gap-1 text-white/50">
              <Clock className="h-3.5 w-3.5 text-purple-400" />
              <span className="font-mono text-white">{formatTimeStr(elapsedSeconds)}</span>
            </div>
            <div className="flex items-center gap-1 text-white/50 border-l border-white/10 pl-3">
              <Users className="h-3.5 w-3.5 text-purple-400" />
              <span className="text-white">{dynamicStudents.length}</span>
            </div>
          </div>

          {/* Red End Session Button */}
          {isTeacher && (
            <button
              onClick={() => setShowEndModal(true)}
              className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl transition-colors cursor-pointer"
            >
              End Session
            </button>
          )}
        </div>
      </header>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      ─── OBSERVER BANNER (Teacher Only) ─
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {isTeacher && teachingMode !== "Human" && (
        <div className="h-10 bg-[#0F0F10] border-b border-white/[0.04] px-6 flex items-center justify-between text-xs text-white/50 flex-shrink-0 z-20">
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-purple-500 animate-pulse" />
            <span className="font-medium">👁 You are observing • AI is teaching</span>
          </div>
          <div className="flex items-center gap-2">
            {teachingMode === "AI" ? (
              <button
                onClick={() => {
                  setTeachingMode("Paused")
                  addToast("AI Teacher paused")
                }}
                className="px-3 py-1 rounded-lg bg-white/5 border border-white/10 text-white hover:bg-white/10 font-bold text-[10px] uppercase tracking-wider transition-colors cursor-pointer"
              >
                Pause AI
              </button>
            ) : (
              <button
                onClick={() => {
                  setTeachingMode("AI")
                  addToast("AI Teacher active")
                }}
                className="px-3 py-1 rounded-lg bg-[#2E1065] border border-purple-500/25 text-purple-300 hover:bg-purple-950 font-bold text-[10px] uppercase tracking-wider transition-colors cursor-pointer"
              >
                Resume AI
              </button>
            )}
            <button
              onClick={() => {
                setTeachingMode("Human")
                addToast("Observer mode deactivated. You are leading the class.")
              }}
              className="px-3 py-1 rounded-lg bg-white/5 border border-white/10 text-white hover:bg-white/10 font-bold text-[10px] uppercase tracking-wider transition-colors cursor-pointer"
            >
              Take Over
            </button>
          </div>
        </div>
      )}

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      ─── MAIN CONTENT AREA (Split Layout) 
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* LEFT + CENTER PANEL (65% width) */}
        <div className="w-[65%] flex flex-col p-5 gap-4.5 overflow-hidden justify-between h-full pb-20">
          
          {/* AI TEACHER TILE (OR COMPACT AI PANEL ABOVE CONTENT) */}
          {teachingMode !== "Human" ? (
            <div className={`bg-[#121214] rounded-2xl border p-4 flex items-center justify-between gap-4.5 transition-all duration-300 relative ${
              teachingMode === "AI"
                ? "border-purple-500/50 shadow-[0_0_15px_rgba(147,51,234,0.15)]"
                : "border-white/[0.04]"
            }`}>
              <div className="flex items-center gap-3">
                {/* Speaking Glowing Orb */}
                <div className={`h-12 w-12 rounded-xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-violet-600 flex items-center justify-center border border-purple-400/25 transition-all ${
                  teachingMode === "AI" ? "scale-105 shadow-[0_0_12px_rgba(147,51,234,0.4)] animate-pulse" : "opacity-45"
                }`}>
                  <Brain className="h-6 w-6 text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white leading-none">Professor AI</h4>
                  <span className="text-[9px] text-white/30 font-bold uppercase tracking-wider mt-1 block">
                    {teachingMode === "AI" ? "Actively Lecturing..." : "Paused"}
                  </span>
                </div>
              </div>

              {/* Red Pulse live dot */}
              <div className="flex items-center gap-3">
                {teachingMode === "AI" ? (
                  <div className="flex items-end gap-1 h-5 w-10 pb-0.5 text-purple-400">
                    <div className="h-full w-0.5 rounded bg-current wv-bar wv-1" />
                    <div className="h-full w-0.5 rounded bg-current wv-bar wv-2" />
                    <div className="h-full w-0.5 rounded bg-current wv-bar wv-3" />
                    <div className="h-full w-0.5 rounded bg-current wv-bar wv-4" />
                    <div className="h-full w-0.5 rounded bg-current wv-bar wv-5" />
                  </div>
                ) : (
                  <div className="flex items-end gap-1 h-5 w-10 pb-0.5 text-white/10">
                    <div className="h-1 w-0.5 rounded bg-current" />
                    <div className="h-1 w-0.5 rounded bg-current" />
                    <div className="h-1 w-0.5 rounded bg-current" />
                  </div>
                )}
                <div className="flex items-center gap-1.5 bg-red-950/20 border border-red-500/20 px-2 py-0.5 rounded-full">
                  <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-[8px] font-black text-red-400 uppercase tracking-widest">Live</span>
                </div>
              </div>
            </div>
          ) : (
            /* AI suggestion compact panel (Human Mode) */
            <div className="bg-[#121214] rounded-2xl border border-white/[0.04] p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-400 animate-pulse">
                  <Brain className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white flex items-center gap-1.5 leading-none">
                    🤖 AI Assistant <span className="text-[9px] text-purple-400 font-extrabold uppercase animate-pulse">Listening...</span>
                  </h4>
                  <p className="text-[10px] text-white/40 mt-1">
                    {aiSuggestions ? aiSuggestions.title : "Listening to your voice triggers to suggest materials..."}
                  </p>
                </div>
              </div>
              {aiSuggestions && (
                <div className="flex gap-2 w-full md:w-auto">
                  <button
                    onClick={() => {
                      addToast("Displaying Carnot schematic on screen")
                      setActiveTopicIdx(1) // Set Carnot diagram
                      setAiSuggestions(null)
                    }}
                    className="flex-1 md:flex-none px-3.5 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-[10px] font-black text-white uppercase tracking-wider transition-colors cursor-pointer"
                  >
                    Show this
                  </button>
                  <button
                    onClick={() => setAiSuggestions(null)}
                    className="flex-1 md:flex-none px-3.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-[10px] font-black text-white/50 uppercase tracking-wider transition-colors cursor-pointer"
                  >
                    Skip
                  </button>
                </div>
              )}
            </div>
          )}

          {/* CONTENT DISPLAY */}
          <div className="flex-1 bg-[#0D0D0E] border border-white/[0.04] rounded-2xl overflow-hidden flex flex-col relative min-h-[300px]">
            {/* Header Badge */}
            <div className="absolute top-4 right-4 z-10 flex gap-2">
              <span className="px-2.5 py-1 rounded bg-black/55 border border-white/5 text-[9px] font-mono font-bold text-purple-400 uppercase tracking-widest">
                {teachingMode === "Human" ? "CAM FEED" : currentContent.type}
              </span>
            </div>

            {/* Core Presenter */}
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center relative">
              <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff01_1px,transparent_1px),linear-gradient(to_bottom,#ffffff01_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none" />
              
              {teachingMode === "Human" ? (
                /* Human instructor camera view */
                <div className="h-full w-full max-w-lg rounded-xl border border-white/[0.06] bg-black overflow-hidden relative flex items-center justify-center">
                  {videoOn ? (
                    <div className="absolute inset-0 flex flex-col justify-between p-4 bg-gradient-to-t from-black/80 to-transparent">
                      <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse self-end border border-black" />
                      <div className="text-left">
                        <span className="text-[9px] font-bold text-purple-400 bg-purple-500/10 px-2.5 py-1 rounded border border-purple-500/20 uppercase tracking-wider">
                          Live Instructor
                        </span>
                        <h4 className="text-sm font-bold text-white mt-1.5">{studentName || "Dr. Sarah Jenkins"}</h4>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center gap-2 text-white/20">
                      <UserIcon className="h-12 w-12" />
                      <span className="text-xs font-bold uppercase tracking-widest">Video Feed Disabled</span>
                    </div>
                  )}
                </div>
              ) : (
                /* AI modes content projection */
                <div className="space-y-4 max-w-xl w-full animate-fadeIn transition-opacity duration-300">
                  {currentContent.type === "VIDEO" && currentContent.url ? (
                    <div className="w-full aspect-video rounded-xl overflow-hidden border border-white/5 bg-black">
                      <iframe 
                        className="w-full h-full"
                        src={currentContent.url}
                        title={currentContent.title}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    </div>
                  ) : (
                    <>
                      <div className="h-24 w-24 rounded-2xl bg-purple-600/5 border border-purple-500/10 flex items-center justify-center text-purple-400 mx-auto shadow-[0_0_20px_rgba(147,51,234,0.05)]">
                        {currentContent.type === "SLIDE" ? (
                          <Presentation className="h-10 w-10" />
                        ) : (
                          <Tv className="h-10 w-10" />
                        )}
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-white tracking-tight">{currentContent.title}</h3>
                        <p className="text-xs text-white/40 mt-1 max-w-md mx-auto leading-relaxed">{currentContent.caption}</p>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Bottom Caption Bar */}
            <div className="h-11 border-t border-white/[0.04] bg-black/15 flex items-center justify-between px-5 text-xs text-white/50">
              <span className="truncate">{teachingMode === "Human" ? "Whiteboard & webcam feed rendering..." : currentContent.caption}</span>
              <span className="font-mono text-[9px] text-white/25 flex-shrink-0 ml-4">PAGE_ID: CLS-0{activeTopicIdx + 1}</span>
            </div>
          </div>

          {/* AI TRANSCRIPT SECTION */}
          {teachingMode !== "Human" && (
            <div className="bg-[#121214] border border-white/[0.04] rounded-2xl p-4.5 space-y-2.5">
              <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wider text-purple-400">
                <Radio className="h-3.5 w-3.5 animate-pulse" />
                Live Subtitles
              </div>
              <div className="max-h-[50px] overflow-y-auto custom-scrollbar text-xs leading-relaxed">
                {AI_LOBBY_SUBTITLES.map((line, idx) => {
                  const isActive = idx === subIndex
                  return (
                    <span
                      key={idx}
                      className={`mr-2 transition-all ${
                        isActive ? "text-purple-400 font-semibold underline decoration-purple-500/30 underline-offset-4" : "text-white/25"
                      }`}
                    >
                      {line}
                    </span>
                  )
                })}
              </div>
            </div>
          )}

        </div>

        {/* RIGHT PANEL (35% width) */}
        <aside className="w-[35%] border-l border-white/[0.05] bg-[#070708] flex flex-col overflow-hidden h-full pb-20">
          
          {/* TOP HALF: STUDENT TILES */}
          <div className="flex-1 p-5 border-b border-white/[0.05] flex flex-col overflow-hidden">
            <h4 className="text-[10px] font-black uppercase tracking-wider text-white border-b border-white/[0.04] pb-3 mb-3 flex items-center justify-between">
              <span>In this class ({dynamicStudents.length})</span>
              <span className="text-[10px] text-emerald-400 font-extrabold flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                {dynamicStudents.filter(s => s.attentionState === "focused").length} Active
              </span>
            </h4>

            {/* Scrollable list */}
            <div className="flex-1 overflow-y-auto custom-scrollbar grid grid-cols-2 gap-3 pr-1">
              {dynamicStudents.map((st) => (
                <div
                  key={st.id}
                  className={`h-24 rounded-xl bg-[#111112] border-2 relative overflow-hidden flex flex-col items-center justify-center transition-all ${st.focusColor}`}
                >
                  {/* Status Indicator */}
                  <span className={`absolute top-2 right-2 text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded ${
                    st.attentionState === "focused"
                      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/15"
                      : st.attentionState === "distracted"
                      ? "bg-amber-500/10 text-amber-400 border border-amber-500/15"
                      : "bg-rose-500/10 text-rose-400 border border-rose-500/15"
                  }`}>
                    {st.attentionState}
                  </span>

                  {/* Circle initial avatar */}
                  <div className="h-7 w-7 rounded-full bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-[10px] font-extrabold text-purple-300">
                    {st.name.slice(0, 2).toUpperCase()}
                  </div>

                  <span className="absolute bottom-2 left-2 text-[10px] font-bold text-white/80 max-w-[100px] truncate">
                    {st.name}
                  </span>

                  <span className="absolute bottom-2 right-2 text-white/30">
                    {st.isMuted ? <MicOff className="h-3 w-3 text-red-500" /> : <Mic className="h-3 w-3 text-emerald-400" />}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* BOTTOM HALF: DOUBT CHAT */}
          <div className={`flex-1 p-5 flex flex-col overflow-hidden transition-all ${chatOpen ? "flex" : "hidden"}`}>
            <h4 className="text-[10px] font-black uppercase tracking-wider text-white border-b border-white/[0.04] pb-3 mb-3.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <MessageSquare className="h-3.5 w-3.5 text-purple-400" />
                Doubt Chat
              </span>
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            </h4>

            {/* Scrolling bubbles */}
            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3.5 pr-1 pb-2 flex flex-col">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex flex-col gap-1 max-w-[85%] ${
                    msg.isAI ? "self-start" : "self-end items-end"
                  }`}
                >
                  <span className="text-[9px] text-white/30 font-bold">{msg.sender} • {msg.time}</span>
                  <div className={`text-xs px-3.5 py-2.5 rounded-xl leading-relaxed relative ${
                    msg.isAI
                      ? "bg-[#161618] text-white/95 border border-white/5 rounded-tl-none flex gap-2 items-start"
                      : "bg-purple-600 text-white rounded-tr-none shadow-md shadow-purple-600/15"
                  }`}>
                    {msg.isAI && <Brain className="h-4 w-4 text-purple-400 flex-shrink-0 mt-0.5" />}
                    <span>{msg.text}</span>
                  </div>
                </div>
              ))}
              <div ref={chatBottomRef} />
            </div>

            {/* Doubt Input form */}
            <form onSubmit={handleSendDoubt} className="flex gap-2 pt-2 border-t border-white/[0.04] mt-auto">
              <input
                type="text"
                required
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Ask a doubt..."
                className="flex-1 px-4 py-2.5 bg-[#121214] border border-white/10 rounded-xl text-xs focus:outline-none focus:border-purple-500 text-white placeholder-white/20"
              />
              <button
                type="submit"
                className="p-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl transition-colors cursor-pointer"
              >
                <CornerDownRight className="h-4 w-4" />
              </button>
            </form>
          </div>
        </aside>

      </div>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      ─── BOTTOM CONTROLS TOOLBAR ────────
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <footer className="fixed bottom-0 left-0 right-0 h-16 bg-[#111112]/90 backdrop-blur-xl border-t border-white/[0.04] px-6 flex items-center justify-between z-30">
        {/* Left Side: General Mic/Cam/Hand controls */}
        <div className="flex items-center gap-2">
          {/* Mic */}
          <div className="relative group">
            <button
              onClick={() => setMicOn(!micOn)}
              className={`p-3 rounded-xl border transition-all cursor-pointer ${
                micOn
                  ? "bg-white/5 border-white/5 text-white/70 hover:bg-white/10"
                  : "bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20"
              }`}
            >
              {micOn ? <Mic className="h-4.5 w-4.5" /> : <MicOff className="h-4.5 w-4.5" />}
            </button>
            <span className="absolute bottom-14 left-1/2 -translate-x-1/2 px-2 py-1 bg-black text-[9px] font-bold text-white rounded border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
              Toggle Mic (M)
            </span>
          </div>

          {/* Camera */}
          <div className="relative group">
            <button
              onClick={() => setVideoOn(!videoOn)}
              className={`p-3 rounded-xl border transition-all cursor-pointer ${
                videoOn
                  ? "bg-white/5 border-white/5 text-white/70 hover:bg-white/10"
                  : "bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20"
              }`}
            >
              {videoOn ? <Video className="h-4.5 w-4.5" /> : <VideoOff className="h-4.5 w-4.5" />}
            </button>
            <span className="absolute bottom-14 left-1/2 -translate-x-1/2 px-2 py-1 bg-black text-[9px] font-bold text-white rounded border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
              Toggle Video (V)
            </span>
          </div>

          {/* Hand */}
          <div className="relative group">
            <button
              onClick={() => {
                setHandRaised(!handRaised)
                if (!handRaised) addToast("You raised your hand ✋")
              }}
              className={`p-3 rounded-xl border transition-all cursor-pointer ${
                handRaised
                  ? "bg-amber-500/15 border-amber-500/25 text-amber-400 hover:bg-amber-500/20"
                  : "bg-white/5 border-white/5 text-white/70 hover:bg-white/10"
              }`}
            >
              <Hand className="h-4.5 w-4.5" />
            </button>
            <span className="absolute bottom-14 left-1/2 -translate-x-1/2 px-2 py-1 bg-black text-[9px] font-bold text-white rounded border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
              Raise Hand (H)
            </span>
          </div>

          {/* Chat Toggle */}
          <div className="relative group">
            <button
              onClick={() => setChatOpen(!chatOpen)}
              className={`p-3 rounded-xl border transition-all cursor-pointer ${
                chatOpen
                  ? "bg-purple-600/10 border-purple-500/20 text-purple-400 hover:bg-purple-600/20"
                  : "bg-white/5 border-white/5 text-white/70 hover:bg-white/10"
              }`}
            >
              <MessageSquare className="h-4.5 w-4.5" />
            </button>
            <span className="absolute bottom-14 left-1/2 -translate-x-1/2 px-2 py-1 bg-black text-[9px] font-bold text-white rounded border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
              Doubt Chat (C)
            </span>
          </div>
        </div>

        {/* Center: Teacher Special Overrides */}
        {isTeacher && (
          <div className="flex items-center gap-2">
            {teachingMode !== "Human" ? (
              <>
                <button
                  onClick={() => {
                    const next = teachingMode === "AI" ? "Paused" : "AI"
                    setTeachingMode(next)
                    addToast(next === "AI" ? "AI Teacher active" : "AI Teacher paused")
                  }}
                  className="px-4 py-2.5 rounded-xl border border-purple-500/20 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 text-xs font-bold transition-all cursor-pointer"
                >
                  {teachingMode === "AI" ? "Pause AI" : "Resume AI"}
                </button>
                <button
                  onClick={() => {
                    setTeachingMode("Human")
                    addToast("Observer mode deactivated. You are leading the class.")
                  }}
                  className="px-4 py-2.5 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.05] text-xs font-bold transition-all cursor-pointer"
                >
                  Take Over
                </button>
              </>
            ) : (
              <>
                {/* Screen Share */}
                <button
                  onClick={() => {
                    setScreenSharing(!screenSharing)
                    addToast(screenSharing ? "Screen sharing ended" : "Screen sharing active")
                  }}
                  className={`p-3 rounded-xl border transition-all cursor-pointer ${
                    screenSharing
                      ? "bg-purple-600/10 border-purple-500/25 text-purple-400"
                      : "bg-white/5 border-white/5 text-white/70 hover:bg-white/10"
                  }`}
                  title="Screen Share"
                >
                  <ScreenShare className="h-4.5 w-4.5" />
                </button>

                {/* Whiteboard */}
                <button
                  onClick={() => {
                    setWhiteboardActive(!whiteboardActive)
                    addToast(whiteboardActive ? "Whiteboard hidden" : "Whiteboard visible")
                  }}
                  className={`p-3 rounded-xl border transition-all cursor-pointer ${
                    whiteboardActive
                      ? "bg-purple-600/10 border-purple-500/25 text-purple-400"
                      : "bg-white/5 border-white/5 text-white/70 hover:bg-white/10"
                  }`}
                  title="Whiteboard Override"
                >
                  <PenTool className="h-4.5 w-4.5" />
                </button>

                <button
                  onClick={() => {
                    setTeachingMode("AI")
                    addToast("AI Teacher activated. AI is leading the class.")
                  }}
                  className="px-4 py-2.5 rounded-xl border border-purple-500/20 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 text-xs font-bold transition-all cursor-pointer"
                >
                  Let AI Teach
                </button>
              </>
            )}

            {/* Record Session */}
            <button
              onClick={() => {
                const next = !isRecording
                setIsRecording(next)
                addToast(next ? "Session recording active" : "Recording saved")
              }}
              className={`px-4.5 py-2.5 rounded-xl border text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                isRecording
                  ? "bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20 animate-pulse"
                  : "bg-white/5 border-white/5 text-white/60 hover:bg-white/10"
              }`}
            >
              <span className="h-2 w-2 rounded-full bg-red-500" />
              Record
            </button>
          </div>
        )}

        {/* Right Side: Exit Class */}
        <Link
          href="/dashboard"
          className="px-4.5 py-2.5 rounded-xl bg-red-600/10 border border-red-500/15 hover:bg-red-600/20 text-red-400 text-xs font-bold transition-all flex items-center gap-1.5"
        >
          <LogOut className="h-4 w-4" />
          Leave Class
        </Link>
      </footer>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      ─── NOTIFICATIONS TOASTS (bottom-left) 
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div className="fixed bottom-20 left-6 z-50 flex flex-col gap-2 max-w-xs pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="flex items-center gap-2.5 bg-[#141416]/95 backdrop-blur border border-white/10 p-3 rounded-xl shadow-2xl animate-slideRight text-xs text-white/95"
          >
            {toast.icon || <Sparkles className="h-4 w-4 text-purple-400 flex-shrink-0" />}
            <span>{toast.text}</span>
          </div>
        ))}
      </div>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      ─── END CONFIRMATION DIALOG MODAL 
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {showEndModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-[#121214] border border-white/10 w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl animate-fadeIn">
            <div className="p-6 text-center space-y-4">
              <div className="h-12 w-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 mx-auto">
                <AlertCircle className="h-6 w-6" />
              </div>
              <div className="space-y-1.5">
                <h3 className="font-bold text-white text-base">End this session?</h3>
                <p className="text-xs text-white/40 leading-relaxed">
                  Ending this session will disconnect all participants and immediately build your post-session analytics report card.
                </p>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-white/[0.04] bg-black/20 flex gap-3">
              <button
                onClick={() => setShowEndModal(false)}
                className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-bold text-white/50 hover:text-white transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={confirmEndClass}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 rounded-xl text-xs font-bold text-white transition-all cursor-pointer"
              >
                End Session
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      ─── END SESSION FLOW SCREEN overlay 
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {endCountdown !== null && (
        <div className="fixed inset-0 bg-[#070708] z-50 flex flex-col items-center justify-center text-center p-6 text-white">
          <div className="space-y-4 max-w-sm mx-auto animate-scaleUp">
            <div className="h-16 w-16 rounded-2xl bg-purple-600/10 border border-purple-500/20 flex items-center justify-center text-purple-400 mx-auto">
              <Brain className="h-8 w-8 animate-pulse" />
            </div>
            <h2 className="text-lg font-black tracking-tight">Class Session Ended</h2>
            <p className="text-xs text-purple-300/80 leading-relaxed font-semibold italic">
              "That's all for today. Great work everyone!"
            </p>
            <p className="text-[10px] text-white/20 pt-2">Building summary analytics... Redirecting in {endCountdown}s</p>
          </div>
        </div>
      )}

    </div>
  )
}
