"use client"

import React, { useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { useParams, useRouter } from "next/navigation"
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Volume2,
  Copy,
  Check,
  Share2,
  Users,
  Settings,
  Brain,
  User as UserIcon,
  Trash2,
  LogOut,
  RefreshCw,
  AlertCircle,
  Menu,
  Eye,
  X,
  Play,
  CheckCircle,
  TrendingUp,
  MessageSquare,
} from "lucide-react"

import {
  subscribeToSession,
  subscribeToStudents,
  endSession,
  startClassEarly,
  updateSessionControls,
  Session,
  Student,
} from "@/lib/session-service"
import { subscribeToAuthChanges } from "@/lib/auth-service"
import DashboardSidebar from "@/components/dashboard-sidebar"
import ClassroomView from "@/components/classroom-view"

const ROTATING_SUBTITLES = [
  "Preparing your AI teacher...",
  "Loading today's topics...",
  "Almost ready to learn...",
]

// Mock AI Script mapping based on topics
const getMockAIScriptForTopic = (topic: string) => {
  const t = topic.toLowerCase()
  if (t.includes("intro") || t.includes("concept")) {
    return "Hello everyone! Welcome to today's session. Today, we'll build a foundational understanding of this topic. I want you to focus on the core relations."
  }
  if (t.includes("example") || t.includes("practice")) {
    return "Let's work through an example together. Look at the visual model appearing on your canvas now. We solve this step-by-step by isolating variables."
  }
  if (t.includes("summary") || t.includes("review")) {
    return "To wrap up, let's review the key takeaways. The most important concept is how these values correlate under change. Make sure to review the session notes."
  }
  return `For this section on "${topic}", I will present the key theories, construct interactive diagrams, and open the doubt solver for student check-ins.`
}

export default function SessionPage() {
  const params = useParams()
  const router = useRouter()
  const sessionCode = (params.code as string).toUpperCase()

  // Authentication & Role
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [isTeacher, setIsTeacher] = useState(false)
  const [studentId, setStudentId] = useState<string | null>(null)
  const [studentName, setStudentName] = useState<string | null>(null)

  // Real-time Database state
  const [session, setSession] = useState<Session | null>(null)
  const [studentsList, setStudentsList] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Student Waiting Room specific states
  const [micEnabled, setMicEnabled] = useState(true)
  const [cameraEnabled, setCameraEnabled] = useState(true)
  const [subtitleIndex, setSubtitleIndex] = useState(0)

  // Teacher Waiting Room specific states
  const [isCopied, setIsCopied] = useState(false)
  const [focusMode, setFocusMode] = useState(false)
  const [allowLateJoins, setAllowLateJoins] = useState(true)
  const [muteOnEntry, setMuteOnEntry] = useState(true)
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false)
  
  // AI Script Modal
  const [showScriptModal, setShowScriptModal] = useState(false)

  // Countdown timer state
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null)

  // Classroom Navigation & Transition states
  const [isClassroomActive, setIsClassroomActive] = useState(false)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [hasPlayedChime, setHasPlayedChime] = useState(false)
  const [studentLateJoinAccepted, setStudentLateJoinAccepted] = useState(false)

  // Web Audio API Synth Chime
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
      
      gainNode.gain.setValueAtTime(0.35, ctx.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.5)
      
      osc1.connect(gainNode)
      osc2.connect(gainNode)
      gainNode.connect(ctx.destination)
      
      osc1.start()
      osc2.start()
      osc1.stop(ctx.currentTime + 1.5)
      osc2.stop(ctx.currentTime + 1.5)
    } catch (e) {
      console.error("Audio Context playback error:", e)
    }
  }

  // 1. Load identities from LocalStorage & Auth
  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedName = localStorage.getItem("studentName")
      const storedId = localStorage.getItem("studentId")
      setStudentName(storedName)
      setStudentId(storedId)
    }

    const unsubscribeAuth = subscribeToAuthChanges((user) => {
      setCurrentUser(user)
    })
    return () => unsubscribeAuth()
  }, [])

  // 2. Load Firestore Data
  useEffect(() => {
    if (!sessionCode) return

    const unsubscribeSession = subscribeToSession(
      sessionCode,
      (updatedSession) => {
        setSession(updatedSession)
        setLoading(false)
        if (!updatedSession) {
          setError("This session does not exist.")
        } else {
          setError(null)
          // Update local toggle states matching Firestore
          setFocusMode(!!updatedSession.focusMode)
          setAllowLateJoins(updatedSession.allowLateJoins !== false)
          setMuteOnEntry(updatedSession.muteOnEntry !== false)
        }
      },
      (err) => {
        console.error(err)
        setError("Error connecting to live session.")
        setLoading(false)
      }
    )

    const unsubscribeStudents = subscribeToStudents(
      sessionCode,
      (updatedStudents) => {
        setStudentsList(updatedStudents)
      },
      (err) => {
        console.error(err)
      }
    )

    return () => {
      unsubscribeSession()
      unsubscribeStudents()
    }
  }, [sessionCode])

  // 3. Determine if current user is the Teacher
  useEffect(() => {
    if (session && currentUser) {
      setIsTeacher(session.teacherId === currentUser.uid)
    } else {
      setIsTeacher(false)
    }
  }, [session, currentUser])

  // 4. Timer Logic
  useEffect(() => {
    if (!session || !session.countdownEndsAt) return

    const checkTimer = () => {
      // countdownEndsAt could be Firestore Timestamp, parse it
      const targetMs = session.countdownEndsAt.seconds
        ? session.countdownEndsAt.seconds * 1000
        : new Date(session.countdownEndsAt).getTime()

      const diff = Math.max(0, Math.floor((targetMs - Date.now()) / 1000))
      setTimeRemaining(diff)

      // When countdown reaches 0:
      if (diff === 0 && session.status !== "Active" && session.status !== "Completed") {
        if (isTeacher) {
          // Teacher automatically transitions session to Active state
          startClassEarly(sessionCode)
        }
      }
    }

    checkTimer()
    const interval = setInterval(checkTimer, 1000)
    return () => clearInterval(interval)
  }, [session, isTeacher, sessionCode])

  // 5. Watch for "Active" session state to trigger classroom transition
  useEffect(() => {
    if (session?.status === "Active" && !isClassroomActive && !isTransitioning) {
      setIsTransitioning(true)
      const timeout = setTimeout(() => {
        setIsTransitioning(false);
        setIsClassroomActive(true);
        console.log("Transition complete");
        console.log("Navigating to classroom");
        router.push(`/classroom/${sessionCode.toLowerCase()}`);
      }, 3000) // 3-second transition ripple

      return () => clearTimeout(timeout)
    }
  }, [session, isClassroomActive, isTransitioning, router, sessionCode])

  // 6. Student view: Rotate subtitle text
  useEffect(() => {
    if (isTeacher) return
    const interval = setInterval(() => {
      setSubtitleIndex((prev) => (prev + 1) % ROTATING_SUBTITLES.length)
    }, 3000)
    return () => clearInterval(interval)
  }, [isTeacher])

  // Callbacks and actions
  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(sessionCode)
      setIsCopied(true)
      setTimeout(() => setIsCopied(false), 2000)
    } catch (err) {
      console.error(err)
    }
  }

  const getShareLink = () => {
    if (typeof window !== "undefined") {
      return `${window.location.origin}/auth?code=${sessionCode}`
    }
    return `https://classai.app/auth?code=${sessionCode}`
  }

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(getShareLink())
      alert("Invite link copied!")
    } catch (err) {
      console.error(err)
    }
  }

  const handleCancelSession = async () => {
    if (confirm("Are you sure you want to cancel this session?")) {
      try {
        await endSession(sessionCode)
        window.location.href = "/dashboard"
      } catch (err) {
        console.error(err)
      }
    }
  }

  const handleStartEarly = async () => {
    try {
      await startClassEarly(sessionCode)
    } catch (err) {
      console.error("Failed to start early:", err)
    }
  }

  const handleToggleFocusMode = async () => {
    const val = !focusMode
    setFocusMode(val)
    await updateSessionControls(sessionCode, { focusMode: val })
  }

  const handleToggleLateJoins = async () => {
    const val = !allowLateJoins
    setAllowLateJoins(val)
    await updateSessionControls(sessionCode, { allowLateJoins: val })
  }

  const handleToggleMuteOnEntry = async () => {
    const val = !muteOnEntry
    setMuteOnEntry(val)
    await updateSessionControls(sessionCode, { muteOnEntry: val })
  }

  // Format time remaining MM:SS
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, "0")
    const s = (secs % 60).toString().padStart(2, "0")
    return `${m}:${s}`
  }

  // Render Loader
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex flex-col items-center justify-center text-white font-sans">
        <div className="h-8 w-8 rounded-full border-2 border-purple-500 border-t-transparent animate-spin mb-4" />
        <p className="text-sm text-white/60">Connecting to session channel...</p>
      </div>
    )
  }

  // Render Error
  if (error || !session) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex flex-col items-center justify-center text-white font-sans p-6 text-center">
        <AlertCircle className="h-10 w-10 text-red-500 mb-4" />
        <h2 className="text-lg font-bold mb-2">Session Error</h2>
        <p className="text-sm text-white/50 mb-6 max-w-sm">
          {error || "We couldn't retrieve the details for this session."}
        </p>
        <Link
          href="/dashboard"
          className="px-5 py-2.5 bg-[#1a1a1a] rounded-xl text-xs font-semibold hover:bg-[#242424] border border-white/5 transition-all"
        >
          Return to Dashboard
        </Link>
      </div>
    )
  }

  // ──────────────────────────────────────────
  // ─── CASE A: RIPPLE TRANSITION OVERLAY ───
  // ──────────────────────────────────────────
  if (isTransitioning) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex flex-col items-center justify-center text-white font-sans overflow-hidden relative">
        {/* Style block for expanding ripples */}
        <style>{`
          @keyframes ripple {
            0% { transform: scale(0.8); opacity: 0.5; }
            100% { transform: scale(2.5); opacity: 0; }
          }
          .ripple-bg {
            position: absolute;
            width: 300px;
            height: 300px;
            border-radius: 50%;
            background: radial-gradient(circle, rgba(147,51,234,0.3) 0%, transparent 70%);
            animation: ripple 2s cubic-bezier(0.1, 0.8, 0.3, 1) infinite;
          }
          .ripple-bg-2 { animation-delay: 0.7s; }
        `}</style>
        <div className="ripple-bg" />
        <div className="ripple-bg ripple-bg-2" />
        
        <div className="relative z-10 flex flex-col items-center gap-4 text-center">
          <div className="h-14 w-14 rounded-2xl bg-purple-600/10 border border-purple-500/20 flex items-center justify-center text-purple-400 animate-bounce">
            <Brain className="h-7 w-7" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight">Class is starting...</h2>
          <p className="text-xs text-white/40">Entering live classroom environment</p>
        </div>
      </div>
    )
  }

  // ──────────────────────────────────────────
  // ─── CASE B: ACTIVE LIVE CLASSROOM VIEW ───
  // ──────────────────────────────────────────
  if (isClassroomActive) {
    return (
      <ClassroomView
        sessionCode={sessionCode}
        session={session}
        studentsList={studentsList}
        isTeacher={isTeacher}
        studentId={studentId}
        studentName={studentName}
      />
    )
  }

  // ──────────────────────────────────────────
  // ─── RENDER METHOD: TEACHER WAITING ROOM ───
  // ──────────────────────────────────────────
  if (isTeacher) {
    const activeStudentCount = studentsList.length

    return (
      <div className="min-h-screen bg-[#111111] text-white flex font-sans antialiased">
        <DashboardSidebar
          activeItem="Dashboard"
          isMobileOpen={isMobileSidebarOpen}
          onCloseMobile={() => setIsMobileSidebarOpen(false)}
        />

        {/* Main Content Area */}
        <div className="flex-1 lg:ml-64 flex flex-col">
          {/* Header */}
          <header className="h-16 border-b border-[#1a1a1a] bg-[#111111]/80 backdrop-blur-xl px-6 md:px-8 flex items-center justify-between sticky top-0 z-20">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsMobileSidebarOpen(true)}
                className="p-1.5 rounded-lg border border-white/10 hover:bg-white/5 lg:hidden text-white/80"
              >
                <Menu className="h-5 w-5" />
              </button>
              
              {/* COUNTDOWN TIMER IN TOP BAR */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-white/40 uppercase">Session Starting in</span>
                <span className="text-lg font-bold text-purple-400 font-mono tracking-widest px-2.5 py-0.5 rounded bg-purple-500/10 border border-purple-500/20">
                  {timeRemaining !== null ? formatTime(timeRemaining) : "02:00"}
                </span>
              </div>
            </div>

            <button
              onClick={handleStartEarly}
              className="flex items-center gap-1 px-4.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-xs font-bold transition-all shadow-md shadow-purple-600/20 cursor-pointer"
            >
              <Play className="h-3 w-3 fill-current" />
              Start Early
            </button>
          </header>

          <main className="flex-1 p-6 md:p-8 max-w-5xl w-full mx-auto grid gap-8 lg:grid-cols-10">
            {/* Left Side: Summary & Actions (60%) */}
            <section className="lg:col-span-6 space-y-6">
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-white">Your session is ready</h2>
                <p className="text-xs text-white/40 mt-1">Configure parameters and launch when ready</p>
              </div>

              {/* Session Info Block */}
              <div className="bg-[#1a1a1a] rounded-2xl border border-white/5 p-6 space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-base font-bold text-white">{session.title}</h3>
                    <div className="flex flex-wrap gap-2 mt-2">
                      <span className="text-[10px] bg-purple-500/10 border border-purple-500/20 text-purple-400 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                        {session.subject}
                      </span>
                      <span className="text-[10px] bg-white/5 border border-white/10 text-white/60 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                        {session.gradeLevel}
                      </span>
                    </div>
                  </div>
                  
                  <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider border ${
                    session.teachingMode === "AI"
                      ? "bg-purple-600/10 border-purple-500/20 text-purple-400"
                      : "bg-blue-600/10 border-blue-500/20 text-blue-400"
                  }`}>
                    {session.teachingMode === "AI" ? <Brain className="h-3 w-3" /> : <UserIcon className="h-3 w-3" />}
                    {session.teachingMode === "AI" ? "AI Teacher" : "I'll Teach"}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4 border-t border-white/5 pt-4 text-xs">
                  <div>
                    <span className="text-white/40 block">Estimated Duration</span>
                    <span className="font-semibold text-white/90">{session.duration}</span>
                  </div>
                  <div>
                    <span className="text-white/40 block">Plan Outline</span>
                    <span className="font-semibold text-white/90">
                      {session.topics?.length || 0} topics registered
                    </span>
                  </div>
                </div>
              </div>

              {/* Large Session Code Box */}
              <div className="bg-[#1a1a1a] rounded-2xl border border-white/5 p-6 text-center space-y-4">
                <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">
                  Invite Students with Code
                </span>

                <div className="relative max-w-sm mx-auto flex items-center justify-between bg-purple-500/10 border border-purple-500/20 p-4.5 rounded-2xl">
                  <span className="text-2xl md:text-3xl font-mono font-bold tracking-widest bg-gradient-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent">
                    {session.code}
                  </span>
                  
                  <div className="flex gap-2">
                    <button
                      onClick={handleCopyCode}
                      className="p-2.5 rounded-xl bg-purple-500/15 text-purple-400 hover:bg-purple-500/25 transition-all cursor-pointer"
                      title="Copy Code"
                    >
                      {isCopied ? <Check className="h-4.5 w-4.5" /> : <Copy className="h-4.5 w-4.5" />}
                    </button>
                    <button
                      className="p-2.5 rounded-xl bg-white/5 text-white/40 hover:text-white/80 hover:bg-white/10 transition-all"
                      title="Regenerate Code"
                    >
                      <RefreshCw className="h-4.5 w-4.5" />
                    </button>
                  </div>
                </div>

                {/* Share Options row */}
                <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                  <button
                    onClick={handleCopyLink}
                    className="flex items-center gap-1.5 px-4.5 py-2.5 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] text-xs font-bold text-white transition-colors cursor-pointer"
                  >
                    <Share2 className="h-3.5 w-3.5 text-purple-400" />
                    Copy Link
                  </button>

                  <a
                    href={`https://api.whatsapp.com/send?text=Join%20our%20ClassAI%20session%20using%20code:%20${sessionCode}%20at%20${getShareLink()}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-4.5 py-2.5 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] text-xs font-bold text-white transition-colors"
                  >
                    <span className="text-emerald-400 text-xs font-semibold">WA</span>
                    WhatsApp
                  </a>

                  <a
                    href={`mailto:?subject=ClassAI%20Invite&body=Join%20my%20session:%20${sessionCode}%20at%20${getShareLink()}`}
                    className="flex items-center gap-1.5 px-4.5 py-2.5 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] text-xs font-bold text-white transition-colors"
                  >
                    <span className="text-purple-400 text-xs font-semibold">@</span>
                    Email Invite
                  </a>
                </div>
              </div>

              {/* Mode Banner & Preview Script */}
              {session.teachingMode === "AI" ? (
                <div className="bg-purple-600/10 border border-purple-500/20 rounded-2xl p-5 space-y-4">
                  <div className="flex gap-4">
                    <div className="h-10 w-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-400 flex-shrink-0">
                      <Brain className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white">AI Teacher will begin automatically when timer reaches zero</h4>
                      <p className="text-[11px] text-purple-300/70 leading-relaxed mt-1">
                        You can preview the AI script below to check what details will be spoken for each topic outline.
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => setShowScriptModal(true)}
                    className="flex items-center gap-1.5 px-4 py-2 bg-purple-600/10 border border-purple-500/20 hover:bg-purple-600/20 text-[10px] font-bold text-purple-400 rounded-xl transition-all cursor-pointer"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    Preview AI Script
                  </button>
                </div>
              ) : (
                <div className="bg-blue-600/10 border border-blue-500/20 rounded-2xl p-5 flex gap-4">
                  <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400 flex-shrink-0">
                    <UserIcon className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white">Instructor Mode</h4>
                    <p className="text-[11px] text-blue-300/70 leading-relaxed mt-1">
                      You are leading this session. The AI assistant is running in the background to generate slides/visuals and automate student doubt resolution.
                    </p>
                  </div>
                </div>
              )}
            </section>

            {/* Right Side: Roster, Options, & Start (40%) */}
            <section className="lg:col-span-4 space-y-6">
              
              {/* Students Joined tiles roster */}
              <div className="bg-[#1a1a1a] rounded-2xl border border-white/5 p-5 flex flex-col h-[300px]">
                <div className="flex items-center justify-between border-b border-white/5 pb-3.5 mb-4 font-sans">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                    Students Joined
                  </h3>
                  <span className="px-2 py-0.5 rounded bg-purple-500/10 text-[10px] text-purple-400 font-bold border border-purple-500/20">
                    {activeStudentCount} ready
                  </span>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2.5">
                  {studentsList.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-4">
                      <Users className="h-8 w-8 text-white/10 mb-2" />
                      <p className="text-xs font-bold text-white/40">Waiting for students to join...</p>
                      <p className="text-[10px] text-white/20 mt-1">Share the code above to invite students</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {studentsList.map((st) => (
                        <div
                          key={st.id}
                          className="flex items-center justify-between p-2.5 bg-white/[0.01] border border-white/5 rounded-xl hover:bg-white/[0.02] animate-slideRight"
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="h-7 w-7 rounded-full bg-purple-600/20 text-purple-300 flex items-center justify-center text-[10px] font-bold uppercase">
                              {st.name.slice(0, 2)}
                            </div>
                            <span className="text-xs font-semibold text-white/95">{st.name}</span>
                          </div>
                          
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-[8px] font-bold text-emerald-400 uppercase tracking-wide">
                            Joined
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Controls Toggle Group */}
              <div className="bg-[#1a1a1a] rounded-2xl border border-white/5 p-5 space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                  Session Controls
                </h3>

                <div className="space-y-4.5 pt-1 text-xs">
                  {/* Toggle 1 */}
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-white/80 font-semibold block">Focus Mode</span>
                      <span className="text-[10px] text-white/30">Track student attention during class</span>
                    </div>
                    <button
                      onClick={handleToggleFocusMode}
                      className={`h-5 w-9 rounded-full p-0.5 transition-colors cursor-pointer relative ${
                        focusMode ? "bg-purple-600" : "bg-white/10"
                      }`}
                    >
                      <div className={`h-4 w-4 rounded-full bg-white transition-transform ${focusMode ? "translate-x-4" : "translate-x-0"}`} />
                    </button>
                  </div>

                  {/* Toggle 2 */}
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-white/80 font-semibold block">Allow Late Joins</span>
                      <span className="text-[10px] text-white/30">Students can join after session starts</span>
                    </div>
                    <button
                      onClick={handleToggleLateJoins}
                      className={`h-5 w-9 rounded-full p-0.5 transition-colors cursor-pointer relative ${
                        allowLateJoins ? "bg-purple-600" : "bg-white/10"
                      }`}
                    >
                      <div className={`h-4 w-4 rounded-full bg-white transition-transform ${allowLateJoins ? "translate-x-4" : "translate-x-0"}`} />
                    </button>
                  </div>

                  {/* Toggle 3 */}
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-white/80 font-semibold block">Mute All on Entry</span>
                      <span className="text-[10px] text-white/30">Students join with mic muted</span>
                    </div>
                    <button
                      onClick={handleToggleMuteOnEntry}
                      className={`h-5 w-9 rounded-full p-0.5 transition-colors cursor-pointer relative ${
                        muteOnEntry ? "bg-purple-600" : "bg-white/10"
                      }`}
                    >
                      <div className={`h-4 w-4 rounded-full bg-white transition-transform ${muteOnEntry ? "translate-x-4" : "translate-x-0"}`} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Start & Cancel actions */}
              <div className="space-y-3 pt-2">
                <button
                  disabled={activeStudentCount === 0}
                  onClick={handleStartEarly}
                  className={`w-full py-3.5 rounded-xl font-bold text-sm text-white shadow-md transition-all flex items-center justify-center gap-1.5 ${
                    activeStudentCount === 0
                      ? "bg-neutral-800 text-white/30 border border-white/5 shadow-none cursor-not-allowed"
                      : "bg-purple-600 hover:bg-purple-500 shadow-purple-600/25 cursor-pointer"
                  }`}
                >
                  {activeStudentCount === 0
                    ? "Start Session"
                    : `Start Session (${activeStudentCount} students ready)`}
                </button>

                <button
                  onClick={handleCancelSession}
                  className="w-full text-center text-xs font-bold text-white/40 hover:text-white/60 transition-colors py-2.5 rounded-xl border border-dashed border-white/5 hover:border-white/10 cursor-pointer"
                >
                  Cancel Session
                </button>
              </div>

            </section>
          </main>
        </div>

        {/* AI SCRIPT PREVIEW MODAL */}
        {showScriptModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-[#1a1a1a] border border-white/5 w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl animate-fadeIn">
              <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Brain className="h-4.5 w-4.5 text-purple-400" />
                  <h3 className="font-bold text-white text-sm">Preview AI Teaching Script</h3>
                </div>
                <button
                  onClick={() => setShowScriptModal(false)}
                  className="text-white/40 hover:text-white transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="p-6 space-y-4 max-h-[350px] overflow-y-auto custom-scrollbar">
                {session.topics && session.topics.length > 0 ? (
                  session.topics.map((tp, idx) => (
                    <div key={idx} className="space-y-1.5">
                      <span className="text-[10px] font-bold text-purple-400 uppercase tracking-wide">
                        Topic #{idx + 1}: {tp}
                      </span>
                      <p className="text-xs text-white/70 leading-relaxed italic bg-white/[0.01] p-3 rounded-xl border border-white/5">
                        "{getMockAIScriptForTopic(tp)}"
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-4 text-xs text-white/30">
                    No custom topics defined. Standard outline script will be spoken.
                  </div>
                )}
              </div>

              <div className="px-6 py-4 border-t border-white/5 bg-black/10 flex justify-end">
                <button
                  onClick={() => setShowScriptModal(false)}
                  className="px-4.5 py-2 bg-purple-600 hover:bg-purple-500 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Got it
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    )
  }

  // ──────────────────────────────────────────
  // ─── RENDER METHOD: STUDENT WAITING ROOM ───
  // ──────────────────────────────────────────
  const activeCount = studentsList.length
  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white flex flex-col font-sans antialiased overflow-x-hidden relative">
      
      {/* Dynamic expanding sonar pulsing rings */}
      <style>{`
        @keyframes sonar {
          0% { transform: scale(0.65); opacity: 0.85; }
          100% { transform: scale(1.6); opacity: 0; }
        }
        .sonar-ring {
          position: absolute;
          border: 1.5px solid rgba(147, 51, 234, 0.25);
          border-radius: 50%;
          animation: sonar 4s cubic-bezier(0.215, 0.610, 0.355, 1.000) infinite;
        }
        .sonar-ring-2 { animation-delay: 1.3s; }
        .sonar-ring-3 { animation-delay: 2.6s; }
      `}</style>

      {/* ─── Top Navigation Bar ─── */}
      <header className="h-16 border-b border-[#1a1a1a] bg-[#0A0A0A]/85 backdrop-blur-xl px-6 flex items-center justify-between sticky top-0 z-20">
        {/* Brand Logo */}
        <div className="flex items-center gap-2">
          <Image src="/logo.png" alt="Class AI" width={28} height={28} />
          <span className="text-base font-bold tracking-tight text-white">
            Class<span className="text-purple-400">AI</span>
          </span>
        </div>

        {/* COUNTDOWN TIMER IN STUDENT TOP BAR */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-white/40 uppercase tracking-wider hidden sm:inline">
            Class begins in
          </span>
          <span className="text-sm font-mono font-bold tracking-widest text-purple-400 bg-purple-500/10 border border-purple-500/20 px-3 py-1 rounded">
            {timeRemaining !== null ? formatTime(timeRemaining) : "02:00"}
          </span>
        </div>

        {/* Student Count Badge */}
        <div className="flex items-center gap-1.5 bg-purple-500/10 border border-purple-500/20 px-3.5 py-1.5 rounded-full">
          <Users className="h-3.5 w-3.5 text-purple-400" />
          <span className="text-[10px] font-bold text-purple-300">
            {activeCount} joined
          </span>
        </div>
      </header>

      {/* ─── Main View ─── */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-6 py-8 flex flex-col items-center justify-center gap-10">
        
        {/* Pulsing rings sonar visualizer */}
        <div className="relative flex items-center justify-center h-44 w-44">
          <div className="sonar-ring sonar-ring-1 h-36 w-36" />
          <div className="sonar-ring sonar-ring-2 h-36 w-36" />
          <div className="sonar-ring sonar-ring-3 h-36 w-36" />

          {/* Logo center badge */}
          <div className="relative h-20 w-20 rounded-full bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-500/20 border border-purple-400/30">
            <Image src="/logo.png" alt="Class AI" width={38} height={38} className="drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]" />
          </div>
        </div>

        {/* Text descriptions */}
        <div className="text-center space-y-2">
          <h2 className="text-xl font-bold text-white tracking-tight">Waiting for class to begin...</h2>
          <p className="text-xs text-purple-400 font-semibold tracking-wide animate-pulse h-4">
            {ROTATING_SUBTITLES[subtitleIndex]}
          </p>
        </div>

        {/* Bottom Split Layout: Info vs Cam Feed */}
        <div className="grid gap-6 md:grid-cols-2 w-full max-w-2xl">
          
          {/* Column A: Session Info Card */}
          <div className="bg-[#1a1a1a] rounded-2xl border border-white/5 p-5 flex flex-col justify-between gap-4">
            <div>
              <span className="text-[9px] font-bold uppercase tracking-wider text-white/30">Class Details</span>
              <h3 className="text-sm font-bold text-white/95 mt-1 leading-snug">{session.title}</h3>
              <p className="text-[10px] text-white/50 mt-1 font-medium">Instructor: {session.teachingMode === "AI" ? "AI Teacher Bot" : "Teacher Lead"}</p>
            </div>

            <div className="grid grid-cols-2 gap-3 border-t border-white/5 pt-3.5 text-[11px]">
              <div>
                <span className="text-white/40 block">Subject / Grade</span>
                <span className="font-semibold text-white/80">{session.subject} • {session.gradeLevel}</span>
              </div>
              <div>
                <span className="text-white/40 block">Estimated Duration</span>
                <span className="font-semibold text-white/80">{session.duration}</span>
              </div>
            </div>
          </div>

          {/* Column B: Camera Preview / Webcam settings */}
          <div className="bg-[#1a1a1a] rounded-2xl border border-white/5 p-5 flex flex-col items-center justify-between gap-4">
            <div className="h-28 w-full rounded-xl bg-black border border-white/5 relative overflow-hidden flex items-center justify-center">
              {cameraEnabled ? (
                <div className="absolute inset-0 flex flex-col justify-between p-3.5">
                  <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse self-end" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-center justify-center text-xs font-semibold text-white/80">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-purple-300 bg-purple-500/10 px-2 py-0.5 border border-purple-500/20 rounded">
                      Video Feed active
                    </span>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center gap-1.5 text-white/30">
                  <VideoOff className="h-7 w-7" />
                  <span className="text-[10px] font-bold uppercase tracking-widest">Camera Disabled</span>
                </div>
              )}
            </div>

            {/* Controls */}
            <div className="flex items-center gap-2 w-full">
              <button
                onClick={() => setMicEnabled(!micEnabled)}
                className={`flex-1 py-2.5 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  micEnabled
                    ? "bg-purple-600/10 border-purple-500/20 text-purple-400 hover:bg-purple-600/20"
                    : "bg-[#111111] border-white/5 text-white/40 hover:border-white/10"
                }`}
              >
                {micEnabled ? <Mic className="h-3.5 w-3.5" /> : <MicOff className="h-3.5 w-3.5" />}
                {micEnabled ? "Mic On" : "Mic Off"}
              </button>

              <button
                onClick={() => setCameraEnabled(!cameraEnabled)}
                className={`flex-1 py-2.5 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  cameraEnabled
                    ? "bg-purple-600/10 border-purple-500/20 text-purple-400 hover:bg-purple-600/20"
                    : "bg-[#111111] border-white/5 text-white/40 hover:border-white/10"
                }`}
              >
                {cameraEnabled ? <Video className="h-3.5 w-3.5" /> : <VideoOff className="h-3.5 w-3.5" />}
                {cameraEnabled ? "Cam On" : "Cam Off"}
              </button>

              <button
                onClick={() => alert("Testing microphone output...")}
                className="p-2.5 rounded-xl bg-white/5 border border-white/5 hover:border-white/10 text-white/60 hover:text-white transition-colors cursor-pointer"
                title="Test Audio"
              >
                <Volume2 className="h-4.5 w-4.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Joined Students Roster Row */}
        <div className="w-full max-w-2xl border-t border-white/5 pt-6 space-y-3">
          <div className="flex items-center justify-between text-[11px] text-white/40">
            <span className="font-bold uppercase tracking-wider">Classmates in lobby</span>
            <span className="font-semibold text-purple-400">{activeCount} students ready</span>
          </div>

          <div className="flex items-center gap-3.5 overflow-x-auto pb-2 custom-scrollbar">
            {studentsList.map((st) => {
              const isCurrentStudent = st.id === studentId
              return (
                <div key={st.id} className="flex flex-col items-center gap-1.5 flex-shrink-0">
                  <div className={`h-11 w-11 rounded-full flex items-center justify-center text-xs font-bold uppercase relative border ${
                    isCurrentStudent
                      ? "bg-purple-600 border-purple-400 text-white shadow-md shadow-purple-500/20"
                      : "bg-[#1a1a1a] border-white/5 text-white/60"
                  }`}>
                    {st.name.slice(0, 2)}
                    {isCurrentStudent && (
                      <span className="absolute -bottom-1 -right-1 h-3.5 w-7 bg-purple-500 border border-[#0A0A0A] rounded-full text-[7px] font-bold text-white flex items-center justify-center tracking-wider scale-95 uppercase">
                        You
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-white/50 font-semibold">{st.name.split(" ")[0]}</span>
                </div>
              )
            })}
          </div>
        </div>

      </main>

      {/* Footer ghost leave button */}
      <footer className="h-14 flex items-center justify-end px-8 z-10">
        <Link
          href="/dashboard"
          className="text-xs font-bold text-white/30 hover:text-red-400/80 transition-colors uppercase tracking-wider"
        >
          Leave Lobby
        </Link>
      </footer>

    </div>
  )
}
