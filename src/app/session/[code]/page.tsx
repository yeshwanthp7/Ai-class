"use client"

import React, { useState, useEffect, useRef } from "react"
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
  Hand,
  CornerDownRight,
  Info,
  Pause,
  RotateCcw,
  Sparkles,
  Tv,
  ScreenShare,
  Presentation,
  PenTool,
  Radio,
  Clock
} from "lucide-react"

import {
  subscribeToSession,
  subscribeToStudents,
  endSession,
  startClassEarly,
  updateSessionControls,
  Session,
  Student,
  checkIsIdKicked,
  checkIsKicked,
  isStudentRegistered,
} from "@/lib/session-service"
import { subscribeToAuthChanges } from "@/lib/auth-service"
import DashboardSidebar from "@/components/dashboard-sidebar"

const ROTATING_SUBTITLES = [
  "Preparing your AI teacher...",
  "Loading today's topics...",
  "Almost ready to learn...",
]

// Claude API simulation helper for topic explanations
const CLAUDE_EXPLANATIONS: Record<string, string> = {
  "thermodynamics": "Thermodynamics is the branch of physics that deals with the relationships between heat and other forms of energy. In particular, it describes how thermal energy is converted to and from other forms of energy and how it affects matter. The fundamental laws governing these changes are crucial in mechanical engineering and physical chemistry.",
  "carnot cycle": "The Carnot cycle is a theoretical thermodynamic cycle proposed by Nicolas Léonard Sadi Carnot in 1824. It provides an upper limit on the efficiency that any classical thermodynamic engine can achieve during the conversion of heat into work, operating between two reservoirs at different temperatures.",
  "entropy": "Entropy is a scientific concept, as well as a measurable physical property, that is most commonly associated with a state of disorder, randomness, or uncertainty. According to the Second Law of Thermodynamics, the total entropy of an isolated system can never decrease over time; it can only remain constant or increase.",
  "absolute zero": "Absolute zero is the lowest limit of the thermodynamic temperature scale, a state at which the enthalpy and entropy of a cooled ideal gas reach their minimum value, taken as zero kelvins. At this state, the fundamental particles of nature have minimal vibrational motion."
}

const getMockAIScriptForTopic = (topic: string) => {
  const t = topic.toLowerCase()
  for (const key of Object.keys(CLAUDE_EXPLANATIONS)) {
    if (t.includes(key)) {
      return CLAUDE_EXPLANATIONS[key]
    }
  }
  return `Let's discuss our next topic: ${topic}. This concept outlines crucial relationships in thermodynamics, connecting heat flow, chemical potential, and molecular distributions. Please pay close attention to the diagram on screen.`
}

const CLAUDE_DOUBT_RESPONSES = [
  "That is an excellent question! In thermodynamics, we define systems as open, closed, or isolated. In a closed system, energy can pass through the boundary but mass cannot.",
  "Great question. Carnot efficiency is indeed the absolute limit because it assumes zero friction and perfectly reversible processes, which are impossible in real-world engineering.",
  "Entropy can be thought of as the number of ways a system can arrange its microstates. The more disorganized a system is, the higher its entropy score.",
  "Absolute zero is a theoretical limit. According to the Third Law, it is impossible to reach absolute zero in a finite number of steps because heat will always leak in."
]

export default function SessionPage() {
  const params = useParams()
  const router = useRouter()
  const sessionCode = (params.code as string).toUpperCase()

  // Authentication & Role
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [isTeacher, setIsTeacher] = useState(false)
  const [studentId, setStudentId] = useState<string | null>(null)
  const [studentName, setStudentName] = useState<string | null>(null)

  // Real-time Database state
  const [session, setSession] = useState<Session | null>(null)
  const [studentsList, setStudentsList] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Transition & Classroom states
  const [isClassroomActive, setIsClassroomActive] = useState(false)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [hasEnteredClassroom, setHasEnteredClassroom] = useState(false)

  // Classroom media states
  const [micOn, setMicOn] = useState(true)
  const [videoOn, setVideoOn] = useState(true)
  const [handRaised, setHandRaised] = useState(false)
  const [chatOpen, setChatOpen] = useState(true)
  const [isRecording, setIsRecording] = useState(false)
  const [screenSharing, setScreenSharing] = useState(false)
  const [whiteboardActive, setWhiteboardActive] = useState(false)

  // Lecture timers & outlines
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [activeTopicIdx, setActiveTopicIdx] = useState(0)
  const [liveSubtitles, setLiveSubtitles] = useState<string>("")
  const [aiSpeechState, setAiSpeechState] = useState<"speaking" | "paused" | "idle">("idle")
  const [teachingMode, setTeachingMode] = useState<"AI" | "Paused" | "Human">("AI")
  
  // Simulated dynamic students
  const [dynamicStudents, setDynamicStudents] = useState<Array<Student & { focusColor: string; attentionState: "focused" | "distracted" | "offline"; isMuted: boolean }>>([])
  const [classFocusAvg, setClassFocusAvg] = useState(87)

  // Doubt Chat messages
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

  // Waiting Room states
  const [micEnabled, setMicEnabled] = useState(true)
  const [cameraEnabled, setCameraEnabled] = useState(true)
  const [subtitleIndex, setSubtitleIndex] = useState(0)
  const [isCopied, setIsCopied] = useState(false)
  const [focusMode, setFocusMode] = useState(false)
  const [allowLateJoins, setAllowLateJoins] = useState(true)
  const [muteOnEntry, setMuteOnEntry] = useState(true)
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false)
  const [showScriptModal, setShowScriptModal] = useState(false)
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null)

  const chatBottomRef = useRef<HTMLDivElement>(null)
  const speechUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null)

  // 1. Mount log
  useEffect(() => {
    console.log("Classroom mounted")
  }, [])

  // 2. Load identities from LocalStorage & Auth (with fallback)
  useEffect(() => {
    try {
      if (typeof window !== "undefined") {
        const storedName = localStorage.getItem("studentName")
        const storedId = localStorage.getItem("studentId")
        setStudentName(storedName || "Guest Student")
        setStudentId(storedId || `guest-${Math.floor(Math.random() * 1000)}`)
      }
    } catch (e) {
      console.warn("localStorage fallback:", e)
      setStudentName("Guest Student")
      setStudentId("guest-id")
    }

    try {
      const unsubscribeAuth = subscribeToAuthChanges((user) => {
        setCurrentUser(user)
        setAuthLoading(false)
      })
      return () => unsubscribeAuth()
    } catch (e) {
      console.error("Auth subscription failed:", e)
      setAuthLoading(false)
    }
  }, [])

  // 3. Load Firebase Database (with Try/Catch & Fallback)
  useEffect(() => {
    if (!sessionCode) return

    let unsubscribeSession = () => {}
    let unsubscribeStudents = () => {}

    try {
      unsubscribeSession = subscribeToSession(
        sessionCode,
        (updatedSession) => {
          if (!updatedSession) {
            // Local fallback if Firebase returns empty
            const fallbackSession: Session = {
              id: sessionCode,
              code: sessionCode,
              title: "Thermodynamics Lab (Offline)",
              subject: "Physics",
              gradeLevel: "Undergraduate",
              duration: "60 mins",
              type: "Public",
              topics: ["Introduction to Thermodynamics", "The Carnot Cycle", "Concept of Entropy"],
              currentTopicIndex: 0,
              status: "Live",
              teacherId: "offline-teacher",
              createdAt: new Date(),
              teachingMode: "AI"
            }
            setSession(fallbackSession)
            setTeachingMode("AI")
            setError(null)
            setLoading(false)
          } else {
            setSession(updatedSession)
            setTeachingMode(updatedSession.teachingMode === "AI" ? "AI" : "Human")
            setError(null)
            setLoading(false)
            console.log("Session data loaded")
            // Sync toggles
            setFocusMode(!!updatedSession.focusMode)
            setAllowLateJoins(updatedSession.allowLateJoins !== false)
            setMuteOnEntry(updatedSession.muteOnEntry !== false)
          }
        },
        (err) => {
          console.error("Firebase session subscription error:", err)
          setError("Failed to load session. Return to dashboard?")
          setLoading(false)
        }
      )

      unsubscribeStudents = subscribeToStudents(
        sessionCode,
        (updatedStudents) => {
          setStudentsList(updatedStudents)
        },
        (err) => {
          console.error("Firebase students subscription error:", err)
        }
      )
    } catch (e) {
      console.error("Firebase connection error:", e)
      setError("Failed to load session. Return to dashboard?")
      setLoading(false)
    }

    return () => {
      unsubscribeSession()
      unsubscribeStudents()
    }
  }, [sessionCode])

  // 4. Determine user role
  useEffect(() => {
    if (session && currentUser) {
      setIsTeacher(session.teacherId === currentUser.uid)
    } else if (session) {
      // Offline fallback check
      setIsTeacher(session.teacherId === "offline-teacher")
    } else {
      setIsTeacher(false)
    }
  }, [session, currentUser])

  // 4b. Enforce admission checks for student
  useEffect(() => {
    if (!session || loading || authLoading) return

    // Calculate synchronously to avoid state update race conditions
    const isUserTeacher = currentUser 
      ? session.teacherId === currentUser.uid 
      : session.teacherId === "offline-teacher"

    if (isUserTeacher) return // Skip access checks for teacher

    const verifyAccess = async () => {
      // 1. Check if kicked
      if (studentId) {
        const isKickedById = await checkIsIdKicked(sessionCode, studentId)
        if (isKickedById) {
          setError("You have been kicked from this session and cannot rejoin.")
          return
        }
      }
      if (studentName) {
        const isKickedByName = await checkIsKicked(sessionCode, studentName)
        if (isKickedByName) {
          setError("You have been kicked from this session and cannot rejoin.")
          return
        }
      }

      // 2. Check registration status
      if (studentId) {
        const registered = await isStudentRegistered(sessionCode, studentId)
        if (!registered) {
          if (session.status === "Active" || session.status === "Completed") {
            setError("This session has already started or ended. Late joins are not allowed.")
          } else {
            // Redirect to join page to enter name/code properly
            router.push(`/auth?role=student&code=${sessionCode}`)
          }
        }
      } else {
        // No student ID, redirect to auth
        router.push(`/auth?role=student&code=${sessionCode}`)
      }
    }

    verifyAccess()
  }, [session, loading, authLoading, currentUser, studentId, studentName, sessionCode, router])


  // 5a. Helper: show transition animation, save data to localStorage, then navigate to /live
  const triggerClassroomTransition = () => {
    if (isClassroomActive || isTransitioning) return
    setIsTransitioning(true)

    // Save session data to localStorage for the /live page (zero Firebase dependency there)
    try {
      if (session) {
        localStorage.setItem("sessionTitle", session.title || "Class Session")
        localStorage.setItem("sessionSubject", session.subject || "General")
        localStorage.setItem("sessionTopics", JSON.stringify(session.topics || []))
        localStorage.setItem("teachingMode", session.teachingMode || "AI")
        localStorage.setItem("userRole", isTeacher ? "teacher" : "student")
        if (studentId) localStorage.setItem("studentId", studentId)
      }
    } catch { /* localStorage blocked — live page will use defaults */ }

    setTimeout(() => {
      setIsTransitioning(false)
      console.log("Transition complete — navigating to /live")
      router.push(`/session/${sessionCode}/live`)
    }, 3000)
  }

  // 5. Countdown timer in waiting room
  useEffect(() => {
    if (!session || !session.countdownEndsAt || isClassroomActive) return

    const checkTimer = () => {
      const targetMs = session.countdownEndsAt.seconds
        ? session.countdownEndsAt.seconds * 1000
        : new Date(session.countdownEndsAt).getTime()

      const diff = Math.max(0, Math.floor((targetMs - Date.now()) / 1000))
      setTimeRemaining(diff)

      if (diff === 0 && session.status !== "Active" && session.status !== "Completed") {
        if (isTeacher) {
          triggerClassroomTransition()
          try {
            startClassEarly(sessionCode)
          } catch (e) {
            console.warn("startClassEarly fail:", e)
          }
        }
      }
    }

    checkTimer()
    const interval = setInterval(checkTimer, 1000)
    return () => clearInterval(interval)
  }, [session, isTeacher, sessionCode, isClassroomActive])

  // 6. Transition state checker — triggers when Firebase status goes "Active"
  useEffect(() => {
    if ((session?.status === "Active") && !isClassroomActive && !isTransitioning) {
      triggerClassroomTransition()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.status, isClassroomActive, isTransitioning])

  // 6b. Completed state checker — redirects student to summary page if session ends
  useEffect(() => {
    if (!isTeacher && session?.status === "Completed") {
      router.push(`/session/${sessionCode}/summary`)
    }
  }, [session?.status, isTeacher, sessionCode, router])


  // 7. Waiting Room: rotate help subtitles
  useEffect(() => {
    if (isClassroomActive) return
    const interval = setInterval(() => {
      setSubtitleIndex((prev) => (prev + 1) % ROTATING_SUBTITLES.length)
    }, 3000)
    return () => clearInterval(interval)
  }, [isClassroomActive])

  // 8. Classroom: Timer elapsed ticking
  useEffect(() => {
    if (!hasEnteredClassroom) return
    const interval = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1)
    }, 1000)
    return () => clearInterval(interval)
  }, [hasEnteredClassroom])

  // 9. Classroom: Simulate students list & focus average
  useEffect(() => {
    if (!hasEnteredClassroom) return
    const simulateFocus = () => {
      // REAL DATA: use Live engagementScore from Firebase
      const updated = studentsList.map((st) => ({
        ...st,
        attentionState: st.status as "focused" | "distracted" | "offline",
        focusColor: 
          (st.status as string) === "focused" ? "border-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.35)]" :
          (st.status as string) === "distracted" ? "border-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.35)]" :
          (st.status as string) === "away" ? "border-rose-500 shadow-[0_0_8px_rgba(239,68,68,0.35)]" :
          "border-gray-600",
        isMuted: true,
      }));

      setDynamicStudents(updated as any);

      if (updated.length > 0) {
        const avg = Math.floor(updated.reduce((acc, c) => acc + (c.engagementScore || 0), 0) / updated.length);
        setClassFocusAvg(avg || 0);
      }
    }

    simulateFocus()
    const interval = setInterval(simulateFocus, 6500)
    return () => clearInterval(interval)
  }, [hasEnteredClassroom, studentsList])

  // Web Speech API synthesiser
  const triggerAudioSpeech = (text: string, onEnd?: () => void) => {
    try {
      window.speechSynthesis.cancel() // clear active queue
      
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.volume = 0.6
      utterance.rate = 1.0
      
      utterance.onstart = () => {
        setAiSpeechState("speaking")
        setLiveSubtitles(text)
      }
      
      utterance.onend = () => {
        setAiSpeechState("idle")
        if (onEnd) onEnd()
      }
      
      utterance.onerror = (e) => {
        console.warn("Speech error:", e)
        setAiSpeechState("idle")
      }
      
      speechUtteranceRef.current = utterance
      window.speechSynthesis.speak(utterance)
    } catch (e) {
      console.warn("Speech synthesis fail:", e)
    }
  }

  // AI Lecture teaching sequence trigger
  const runAiTopicSpeech = (topicIdx: number) => {
    if (!session || !session.topics || session.topics.length === 0) return
    
    const topic = session.topics[topicIdx]
    const lectureText = getMockAIScriptForTopic(topic)
    
    triggerAudioSpeech(lectureText, () => {
      // Go to next topic when speech ends
      const nextIdx = topicIdx + 1
      if (nextIdx < session.topics.length) {
        addToast("Moving to next topic")
        setActiveTopicIdx(nextIdx)
        setTimeout(() => runAiTopicSpeech(nextIdx), 1500)
      } else {
        triggerAudioSpeech("That completes our course outline for today. Feel free to review the session materials.")
      }
    })
  }

  // Handle Doubt resolve
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

    // Pause teaching speech
    try {
      window.speechSynthesis.pause()
      setAiSpeechState("paused")
      addToast("AI paused teaching to answer doubt")
    } catch (err) {
      console.warn("Error pausing speech:", err)
    }

    // Call Claude API (Simulated prompt delay)
    setTimeout(() => {
      const randomAns = CLAUDE_DOUBT_RESPONSES[Math.floor(Math.random() * CLAUDE_DOUBT_RESPONSES.length)]
      const aiResponse = {
        id: (Date.now() + 1).toString(),
        sender: "Professor AI",
        text: randomAns,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        isAI: true,
      }
      setMessages((prev) => [...prev, aiResponse])
      
      // Speak the Claude response, then resume teaching
      triggerAudioSpeech(randomAns, () => {
        triggerAudioSpeech("Great question! Now let's continue...", () => {
          // Resume main lecture
          runAiTopicSpeech(activeTopicIdx)
        })
      })
    }, 2000)
  }

  // Confirm End session
  const handleEndClass = () => {
    setShowEndModal(false)
    setEndCountdown(5)
    triggerAudioSpeech("That is all for today. Great work everyone!")
  }

  // End countdown timer redirect
  useEffect(() => {
    if (endCountdown === null) return
    if (endCountdown === 0) {
      router.push(`/session/${sessionCode}/summary`)
      return
    }
    const timer = setTimeout(() => {
      setEndCountdown((c) => (c !== null ? c - 1 : null))
    }, 1000)
    return () => clearTimeout(timer)
  }, [endCountdown, sessionCode, router])

  // Toast adder
  const addToast = (text: string, icon?: React.ReactNode) => {
    const id = Date.now().toString()
    setToasts((prev) => [...prev, { id, text, icon }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 4000)
  }

  const formatTimeStr = (secs: number) => {
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
          {error || "Failed to load session. Return to dashboard?"}
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
  // ─── WAITING ROOM: RIPPLE TRANSITION ──────
  // ──────────────────────────────────────────
  if (isTransitioning) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex flex-col items-center justify-center text-white font-sans overflow-hidden relative">
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
  // ─── CLASSROOM REDIRECT FALLBACK ──────────
  // ──────────────────────────────────────────
  if (isClassroomActive) {
    router.push(`/session/${sessionCode}/live`)
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex flex-col items-center justify-center text-white font-sans">
        <div className="h-8 w-8 rounded-full border-2 border-purple-500 border-t-transparent animate-spin mb-4" />
        <p className="text-sm text-white/60">Entering classroom...</p>
      </div>
    )
  }

  // ──────────────────────────────────────────
  // ─── WAITING ROOM SCREEN ─────────────────
  // ──────────────────────────────────────────
  const activeStudentCount = studentsList.length
  return (
    <div className="min-h-screen bg-[#111111] text-white flex font-sans antialiased">
      {isTeacher ? (
        /* TEACHER WAITING ROOM */
        <div className="flex-1 flex">
          <DashboardSidebar
            activeItem="Dashboard"
            isMobileOpen={isMobileSidebarOpen}
            onCloseMobile={() => setIsMobileSidebarOpen(false)}
          />

          <div className="flex-1 lg:ml-64 flex flex-col">
            <header className="h-16 border-b border-[#1a1a1a] bg-[#111111]/80 backdrop-blur-xl px-6 md:px-8 flex items-center justify-between sticky top-0 z-20">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setIsMobileSidebarOpen(true)}
                  className="p-1.5 rounded-lg border border-white/10 hover:bg-white/5 lg:hidden text-white/80"
                >
                  <Menu className="h-5 w-5" />
                </button>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-white/40 uppercase">Session Starting in</span>
                  <span className="text-lg font-bold text-purple-400 font-mono tracking-widest px-2.5 py-0.5 rounded bg-purple-500/10 border border-purple-500/20">
                    {timeRemaining !== null ? formatTimeStr(timeRemaining) : "02:00"}
                  </span>
                </div>
              </div>

              <button
                onClick={async () => {
                  triggerClassroomTransition()
                  try {
                    await startClassEarly(sessionCode)
                  } catch (e) {
                    console.warn("startClassEarly Firebase error (continuing with local transition):", e)
                  }
                }}
                className="flex items-center gap-1 px-4.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-xs font-bold transition-all cursor-pointer"
              >
                <Play className="h-3 w-3 fill-current" />
                Start Early
              </button>
            </header>

            <main className="flex-1 p-6 md:p-8 max-w-5xl w-full mx-auto grid gap-8 lg:grid-cols-10">
              <section className="lg:col-span-6 space-y-6">
                <div>
                  <h2 className="text-2xl font-bold tracking-tight text-white">Your session is ready</h2>
                  <p className="text-xs text-white/40 mt-1">Invite students and start the session below</p>
                </div>

                <div className="bg-[#1a1a1a] rounded-2xl border border-white/5 p-6 space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-base font-bold text-white">{session.title}</h3>
                      <div className="flex flex-wrap gap-2 mt-2">
                        <span className="text-[10px] bg-purple-500/10 border border-purple-500/20 text-purple-400 font-bold px-2 py-0.5 rounded-full uppercase">
                          {session.subject}
                        </span>
                        <span className="text-[10px] bg-white/5 border border-white/10 text-white/60 font-bold px-2 py-0.5 rounded-full uppercase">
                          {session.gradeLevel}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-[#1a1a1a] rounded-2xl border border-white/5 p-6 text-center space-y-4">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">
                    Invite Students with Code
                  </span>
                  <div className="relative max-w-sm mx-auto flex items-center justify-between bg-purple-500/10 border border-purple-500/20 p-4.5 rounded-2xl">
                    <span className="text-2xl font-mono font-bold tracking-widest text-purple-400">
                      {session.code}
                    </span>
                    <button
                      onClick={async () => {
                        await navigator.clipboard.writeText(sessionCode)
                        setIsCopied(true)
                        setTimeout(() => setIsCopied(false), 2000)
                      }}
                      className="p-2.5 rounded-xl bg-purple-500/15 text-purple-400 hover:bg-purple-500/25 transition-all cursor-pointer"
                    >
                      {isCopied ? <CheckCircle className="h-4.5 w-4.5" /> : <Copy className="h-4.5 w-4.5" />}
                    </button>
                  </div>
                </div>
              </section>

              <section className="lg:col-span-4 space-y-6">
                <div className="bg-[#1a1a1a] rounded-2xl border border-white/5 p-5 flex flex-col h-[300px]">
                  <div className="flex items-center justify-between border-b border-white/5 pb-3 mb-4">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-white">Students Joined</h3>
                    <span className="px-2 py-0.5 rounded bg-purple-500/10 text-[10px] text-purple-400 font-bold">
                      {activeStudentCount} ready
                    </span>
                  </div>

                  <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2">
                    {studentsList.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-center p-4">
                        <Users className="h-8 w-8 text-white/10 mb-2" />
                        <p className="text-xs font-bold text-white/40">Waiting for students...</p>
                      </div>
                    ) : (
                      studentsList.map((st) => (
                        <div key={st.id} className="flex items-center justify-between p-2.5 bg-white/[0.01] border border-white/5 rounded-xl">
                          <span className="text-xs font-semibold text-white/95">{st.name}</span>
                          <span className="px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-[8px] font-bold text-emerald-400 uppercase">Joined</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <button
                  onClick={async () => {
                    triggerClassroomTransition()
                    try {
                      await startClassEarly(sessionCode)
                    } catch (e) {
                      console.warn("startClassEarly Firebase error (continuing with local transition):", e)
                    }
                  }}
                  className="w-full py-3.5 bg-purple-600 hover:bg-purple-500 rounded-xl font-bold text-sm text-white transition-all cursor-pointer"
                >
                  Start Session
                </button>
              </section>
            </main>
          </div>
        </div>
      ) : (
        /* STUDENT WAITING LOBBY */
        <div className="min-h-screen bg-[#0A0A0A] w-full flex flex-col items-center justify-center p-6 text-center">
          <div className="max-w-md w-full space-y-8 animate-scaleUp">
            <div className="space-y-4">
              <div className="h-16 w-16 rounded-2xl bg-purple-600/10 border border-purple-500/20 flex items-center justify-center text-purple-400 mx-auto">
                <Brain className="h-8 w-8 animate-pulse" />
              </div>
              <h2 className="text-2xl font-black text-white">Waiting Lobby</h2>
              <p className="text-xs text-white/40">
                {ROTATING_SUBTITLES[subtitleIndex]}
              </p>
            </div>
            
            <div className="bg-[#111112] border border-white/5 p-6 rounded-2xl space-y-4">
              <div className="text-left space-y-1">
                <span className="text-[10px] text-purple-400 uppercase font-black">Joining Session</span>
                <h3 className="text-base font-bold text-white">{session.title}</h3>
                <p className="text-[11px] text-white/40">{session.subject} • {session.gradeLevel}</p>
              </div>

              <div className="border-t border-white/5 pt-4 text-xs flex items-center justify-between text-white/50">
                <span>Classroom status:</span>
                <span className="text-purple-400 font-bold uppercase animate-pulse">Waiting for host...</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
