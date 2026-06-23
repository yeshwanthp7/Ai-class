"use client"

import React, { useState, useEffect, useRef, useCallback } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import {
  Brain,
  Users,
  Mic,
  MicOff,
  Video,
  VideoOff,
  Hand,
  MessageSquare,
  ScreenShare,
  Play,
  Pause,
  X,
  AlertCircle,
  Clock,
  LogOut,
  RotateCcw,
  Send,
  Volume2,
  VolumeX,
  Eye,
  VideoOff as CameraOff,
} from "lucide-react"

import { getFile } from "@/lib/fileStorage"
import { extractPDFPages } from "@/lib/pdfParser"
import StudentCamera from "@/components/StudentCamera"
import { subscribeToStudents, subscribeToSession, syncClassroomProgress } from "@/lib/session-service"

/* ─── MOCK DATA ─── */

const MOCK_TOPICS = ["Introduction to Thermodynamics", "The Carnot Cycle", "Concept of Entropy"]

const DOUBT_RESPONSES = [
  "Excellent question! In thermodynamics, we define systems as open, closed, or isolated. Energy can cross boundaries in a closed system, but matter cannot.",
  "Great question. Carnot efficiency is the theoretical maximum because it assumes zero friction and perfectly reversible processes.",
  "Entropy can be thought of as the number of microstates available to a system. Higher entropy means more disorder.",
  "Absolute zero is the theoretical lower limit of temperature. The Third Law states you cannot reach it in a finite number of steps.",
]


/* ─── COMPONENT ─── */

export default function LiveClassroomPage() {
  const params = useParams()
  const router = useRouter()
  const sessionCode = ((params.code as string) || "UNKNOWN").toUpperCase()

  const [sessionTitle, setSessionTitle] = useState("Physics Lab Session")
  const [sessionSubject, setSessionSubject] = useState("Physics")
  const [topics, setTopics] = useState<string[]>(MOCK_TOPICS)
  const [teachingMode, setTeachingMode] = useState<"AI" | "Human">("AI")
  const [isTeacher, setIsTeacher] = useState(true)
  const isStudent = !isTeacher;
  const [studentId, setStudentId] = useState("unknown-student")
  const [hasEntered, setHasEntered] = useState(false)

  const [pdfPages, setPdfPages] = useState<string[]>([])
  const [isPdfMode, setIsPdfMode] = useState(false)
  const [isParsingPdf, setIsParsingPdf] = useState(true)

  const [activeTopicIdx, setActiveTopicIdx] = useState(0)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [micOn, setMicOn] = useState(true)
  const [videoOn, setVideoOn] = useState(true)
  const [handRaised, setHandRaised] = useState(false)
  const [chatOpen, setChatOpen] = useState(true)
  const [isRecording, setIsRecording] = useState(false)
  const [screenSharing, setScreenSharing] = useState(false)

  const [aiSpeechState, setAiSpeechState] = useState<"speaking" | "paused" | "idle">("idle")
  const [liveSubtitles, setLiveSubtitles] = useState("")
  const [speechEnabled, setSpeechEnabled] = useState(true)
  const speechRef = useRef<SpeechSynthesisUtterance | null>(null)

  const [transcript, setTranscript] = useState("")
  const [pastTranscripts, setPastTranscripts] = useState<string[]>([])
  const [topicImageUrl, setTopicImageUrl] = useState<string | null>(null)
  const [imageLoaded, setImageLoaded] = useState(false)
  const [imageFading, setImageFading] = useState(false)

  const [students, setStudents] = useState<any[]>([])
  const [classFocus, setClassFocus] = useState(0)
  const [localMetrics, setLocalMetrics] = useState<{score: number, status: string}>({score: 0, status: "offline"})
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({})
  const peerRef = useRef<any>(null)
  const callsRef = useRef<Record<string, any>>({})

  const [chatInput, setChatInput] = useState("")
  const [isAnswering, setIsAnswering] = useState(false)
  const isAnsweringRef = useRef(false)
  const transcriptRef = useRef<string[]>([])
  const [messages, setMessages] = useState<Array<{
    id: string; sender: string; text: string; time: string; isAI: boolean
  }>>([
    { id: "welcome", sender: "Professor AI", text: "Welcome to today's session. Type any doubts here and I'll pause to answer.", time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }), isAI: true },
  ])
  const chatEndRef = useRef<HTMLDivElement>(null)
  const transcriptEndRef = useRef<HTMLDivElement>(null)

  const [toasts, setToasts] = useState<Array<{ id: string; text: string }>>([])
  const [showEndModal, setShowEndModal] = useState(false)
  const [endCountdown, setEndCountdown] = useState<number | null>(null)

  /* ─── INIT ─── */
  useEffect(() => {
    try {
      const title = localStorage.getItem("sessionTitle")
      const subject = localStorage.getItem("sessionSubject")
      const storedTopics = localStorage.getItem("sessionTopics")
      const mode = localStorage.getItem("teachingMode")
      const role = localStorage.getItem("userRole")
      const storedStudentId = localStorage.getItem("studentId")
      if (title) setSessionTitle(title)
      if (subject) setSessionSubject(subject)
      if (storedTopics) { try { setTopics(JSON.parse(storedTopics)) } catch { /* defaults */ } }
      if (mode === "Human") setTeachingMode("Human")
      if (role === "student") setIsTeacher(false)
      if (storedStudentId) setStudentId(storedStudentId)
    } catch { /* keep defaults */ }

    const loadPdf = async () => {
      try {
        const file = await getFile("session-pdf")
        if (file) {
          const pages = await extractPDFPages(file)
          if (pages.length > 0) {
            setPdfPages(pages)
            setIsPdfMode(true)
          }
        }
      } catch (err) {
        console.error("PDF load error:", err)
      } finally {
        setIsParsingPdf(false)
      }
    }
    loadPdf()
  }, [])

  const addToast = useCallback((text: string) => {
    const id = Date.now().toString()
    setToasts((prev) => [...prev, { id, text }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000)
  }, [])

  /* ─── GROQ API ─── */
  const teachContent = useCallback(async (content: string, isPdf: boolean): Promise<string> => {
    const systemPrompt = isPdf
      ? `You are Professor AI. The overall course topic is "${sessionTitle}". Read this slide/page content and explain it to students in simple engaging language. Max 4 sentences. Use examples.`
      : `You are Professor AI, an engaging teacher. The overall course topic is "${sessionTitle}". Explain this topic in 4-5 sentences. Be clear, use examples, speak naturally as if lecturing a class.`
    const userPrompt = isPdf ? content : "Teach this topic: " + content
    
    try {
      const response = await fetch("/api/groq", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ system: systemPrompt, prompt: userPrompt }),
      })
      if (!response.ok) throw new Error(`API ${response.status}`)
      const data = await response.json()
      
      if (!data.text) throw new Error("No text in response")
      return data.text
    } catch (err) {
      console.error("Groq API Error:", err)
      return "AI unavailable - check API key"
    }
  }, [])

  /* ─── PEXELS IMAGE ─── */
  const loadContextImage = useCallback(async (content: string, isPdf: boolean) => {
    let keywords = ""
    if (isPdf) {
      keywords = content.split(/\s+/).slice(0, 5).join(" ")
    } else {
      keywords = content
        .toLowerCase()
        .replace(/introduction to|concept of|the /gi, "")
        .trim()
    }

    console.log('Fetching image for:', keywords)

    setImageFading(true)
    setImageLoaded(false)

    try {
      const res = await fetch(`/api/pexels?query=${encodeURIComponent(keywords)}`)
      const data = await res.json()
      console.log('Pexels response:', data.imageUrl)
      
      const url = data.imageUrl
      if (url) {
        // Preload
        const img = new window.Image()
        img.onload = () => {
          setTimeout(() => {
            setTopicImageUrl(url)
            setImageLoaded(true)
            setImageFading(false)
          }, 250)
        }
        img.onerror = () => {
          setTopicImageUrl(null)
          setImageLoaded(false)
          setImageFading(false)
        }
        img.src = url
      } else {
        setTopicImageUrl(null)
        setImageLoaded(false)
        setImageFading(false)
      }
    } catch (err) {
      console.error('Pexels failed:', err)
      setTopicImageUrl(null)
      setImageLoaded(false)
      setImageFading(false)
    }
  }, [])

  /* ─── WEB SPEECH ─── */
  const speakText = useCallback((text: string, onEnd?: () => void) => {
    if (!speechEnabled) {
      setAiSpeechState("speaking")
      setLiveSubtitles(text)
      const duration = Math.max(3000, text.split(/\s+/).length * 250)
      setTimeout(() => { setAiSpeechState("idle"); if (onEnd) onEnd() }, duration)
      return
    }
    try {
      window.speechSynthesis.cancel()
      const u = new SpeechSynthesisUtterance(text)
      u.volume = 0.55; u.rate = 0.85; u.pitch = 1.0
      u.onstart = () => { setAiSpeechState("speaking"); setLiveSubtitles(text) }
      u.onend = () => { setAiSpeechState("idle"); if (onEnd) onEnd() }
      u.onerror = () => setAiSpeechState("idle")
      speechRef.current = u
      window.speechSynthesis.speak(u)
    } catch { setAiSpeechState("idle") }
  }, [speechEnabled])

  /* ─── AI TEACHING SEQUENCE ─── */
  const runTopicSpeech = useCallback(async (idx: number) => {
    const items = isPdfMode ? pdfPages : topics
    if (idx >= items.length) {
      speakText("That concludes our topics for today. Feel free to review the materials and ask any remaining questions.")
      return
    }
    const currentItem = items[idx]
    loadContextImage(currentItem, isPdfMode)
    setAiSpeechState("speaking")
    
    const explanation = await teachContent(currentItem, isPdfMode)
    transcriptRef.current.push(explanation)
    setTranscript((prev) => {
      if (prev) setPastTranscripts((old) => [...old, prev])
      return explanation
    })
    speakText(explanation, () => {
      const next = idx + 1
      if (next < items.length) {
        addToast(isPdfMode ? `Moving to Page ${next + 1}` : `Moving to Topic ${next + 1}`)
        setActiveTopicIdx(next)
        syncClassroomProgress(sessionCode, next)
        setTimeout(() => runTopicSpeech(next), 2000)
      } else {
        speakText("That concludes our topics for today. Feel free to review the materials and ask any remaining questions.")
      }
    })
  }, [topics, pdfPages, isPdfMode, speakText, addToast, teachContent, loadContextImage])

  /* ─── ENTER CLASSROOM ─── */
  const handleEnterClassroom = useCallback(() => {
    try { window.speechSynthesis.cancel() } catch { /* ok */ }
    setHasEntered(true)
    if (teachingMode === "AI") setTimeout(() => runTopicSpeech(0), 800)
  }, [teachingMode, runTopicSpeech])

  /* ─── CLEANUP: kill speech on unmount (navigation away) ─── */
  useEffect(() => {
    return () => {
      try { window.speechSynthesis.cancel() } catch { /* ok */ }
    }
  }, [])

  /* ─── TIMER ─── */
  useEffect(() => {
    if (!hasEntered) return
    const i = setInterval(() => setElapsedSeconds((s) => s + 1), 1000)
    return () => clearInterval(i)
  }, [hasEntered])

  /* ─── CLASSROOM SYNC ─── */
  useEffect(() => {
    if (!hasEntered || !sessionCode) return
    const unsubscribe = subscribeToSession(
      sessionCode,
      (updated) => {
        if (!updated) return;
        // Sync topic for students
        if (!isTeacher && updated.currentTopicIndex !== undefined && updated.currentTopicIndex !== activeTopicIdx) {
          setActiveTopicIdx(updated.currentTopicIndex)
        }
      },
      (err) => console.error("Session sync error:", err)
    )
    return () => unsubscribe()
  }, [hasEntered, sessionCode, isTeacher, activeTopicIdx])

  /* ─── STUDENTS SIM ─── */
  useEffect(() => {
    if (!hasEntered || !sessionCode) return
    const unsubscribe = subscribeToStudents(
      sessionCode,
      (updated) => {
        setStudents(updated)
        if (updated.length > 0) {
          setClassFocus(Math.floor(updated.reduce((a, s) => a + (s.engagementScore || 0), 0) / updated.length))
        }
      },
      (err) => {
        console.error("Failed to sync students in live page:", err)
      }
    )
    return () => unsubscribe()
  }, [hasEntered, sessionCode])

  // Use a ref to access the latest localStream inside PeerJS callbacks without recreating the Peer
  const localStreamRef = useRef<MediaStream | null>(null);
  useEffect(() => {
    localStreamRef.current = localStream;
  }, [localStream]);

  /* ─── WebRTC PEERJS INIT ─── */
  useEffect(() => {
    if (!hasEntered || !studentId) return;

    let peer: any;
    const initPeer = async () => {
      const { Peer } = await import('peerjs');
      peer = new Peer(studentId, {
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: "turn:openrelay.metered.ca:80", username: "openrelayproject", credential: "openrelayproject" },
            { urls: "turn:openrelay.metered.ca:443", username: "openrelayproject", credential: "openrelayproject" },
            { urls: "turn:openrelay.metered.ca:443?transport=tcp", username: "openrelayproject", credential: "openrelayproject" }
          ]
        }
      });
      peerRef.current = peer;

      peer.on('open', (id: string) => {
        console.log("PeerJS Connected. ID:", id);
      });

      peer.on('call', (call: any) => {
        console.log("Incoming call from:", call.peer);
        
        let attempts = 0;
        const checkStreamAndAnswer = () => {
          if (localStreamRef.current) {
            call.answer(localStreamRef.current);
          } else if (attempts >= 10) {
            console.log("Answering call without stream (camera took too long or denied)");
            call.answer(undefined);
          } else {
            attempts++;
            setTimeout(checkStreamAndAnswer, 500);
          }
        };
        checkStreamAndAnswer();
        
        call.on('stream', (remoteStream: MediaStream) => {
          console.log("Received stream from caller:", call.peer);
          setRemoteStreams(prev => ({ ...prev, [call.peer]: remoteStream }));
        });
        callsRef.current[call.peer] = call;
      });

      peer.on('error', (err: any) => {
        console.error("PeerJS Error:", err);
      });
    };
    initPeer();

    return () => {
      if (peer) peer.destroy();
    };
  // IMPORTANT: Do NOT include localStream here, otherwise the peer is destroyed and recreated when camera turns on
  }, [hasEntered, studentId]);

  /* ─── WebRTC AUTO-CALL OUTGOING ─── */
  useEffect(() => {
    if (!peerRef.current || !localStream || students.length === 0) return;

    students.forEach((student: any) => {
      if (student.id !== studentId && !callsRef.current[student.id]) {
        console.log("Calling newly discovered student:", student.id);
        const call = peerRef.current.call(student.id, localStream);
        if (call) {
          callsRef.current[student.id] = call;
          call.on('stream', (remoteStream: MediaStream) => {
             console.log("Received stream from answerer:", student.id);
             setRemoteStreams(prev => ({ ...prev, [student.id]: remoteStream }));
          });
          call.on('error', (err: any) => console.error("Call error:", err));
        }
      }
    });
  }, [students, localStream, studentId]);

  const handleStreamReady = useCallback((stream: MediaStream) => {
    setLocalStream(stream);
  }, []);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }) }, [messages])
  useEffect(() => { transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" }) }, [transcript, pastTranscripts])

  /* ─── DOUBT ─── */
  const handleSendDoubt = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isAnsweringRef.current || !chatInput.trim()) return
    isAnsweringRef.current = true
    setIsAnswering(true)
    
    const question = chatInput.trim()
    const userMsg = { id: Date.now().toString(), sender: "You", text: question, time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }), isAI: false }
    setMessages((prev) => [...prev, userMsg])
    setChatInput("")
    
    try { window.speechSynthesis.pause(); setAiSpeechState("paused"); addToast("AI paused to answer doubt") } catch { /* ok */ }
    
    let answer: string
    try {
      const system = `You are a classroom AI teacher.\nThe student asked you: "${question}"\nAnswer that exact question in 2 sentences max.\nDo not answer a different question.\nDo not say "Great question" or any filler.\nDo not talk about Carnot or unrelated topics\nunless the student specifically asked about it.\nJust answer what was asked.`
      
      console.log('Question:', question)
      console.log('Transcript context:', 'REMOVED FOR DEBUGGING')
      console.log('Full prompt being sent:', { system, prompt: question })

      const res = await fetch("/api/groq", { 
        method: "POST", 
        headers: { "Content-Type": "application/json" }, 
        body: JSON.stringify({ system, prompt: question }) 
      })
      if (res.ok) { 
        const d = await res.json()
        answer = d.text || DOUBT_RESPONSES[Math.floor(Math.random() * DOUBT_RESPONSES.length)] 
      } else { 
        answer = DOUBT_RESPONSES[Math.floor(Math.random() * DOUBT_RESPONSES.length)] 
      }

      setMessages((prev) => [...prev, { id: (Date.now() + 1).toString(), sender: "Professor AI", text: answer, time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }), isAI: true }])
      speakText(answer, () => {
        speakText("Let's continue...", () => runTopicSpeech(activeTopicIdx))
      })

    } catch {
      answer = DOUBT_RESPONSES[Math.floor(Math.random() * DOUBT_RESPONSES.length)]
      setMessages((prev) => [...prev, { id: (Date.now() + 1).toString(), sender: "Professor AI", text: answer, time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }), isAI: true }])
      speakText(answer, () => {
        speakText("Let's continue...", () => runTopicSpeech(activeTopicIdx))
      })
    } finally {
      isAnsweringRef.current = false
      setIsAnswering(false)
    }
  }

  const handleConfirmEnd = () => { setShowEndModal(false); setEndCountdown(5); try { window.speechSynthesis.cancel() } catch { /* ok */ } }
  useEffect(() => {
    if (endCountdown === null) return
    if (endCountdown === 0) { router.push("/dashboard"); return }
    const t = setTimeout(() => setEndCountdown((c) => (c !== null ? c - 1 : null)), 1000)
    return () => clearTimeout(t)
  }, [endCountdown, router])

  useEffect(() => {
    if (!hasEntered) return
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      switch (e.key.toLowerCase()) {
        case "m": setMicOn((v) => !v); break
        case "v": setVideoOn((v) => !v); break
        case "h": setHandRaised((v) => !v); break
        case "c": setChatOpen((v) => !v); break
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [hasEntered])

  const fmt = (s: number) => `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`
  const totalItems = isPdfMode ? pdfPages.length : topics.length
  const progressPct = totalItems > 0 ? Math.floor(((activeTopicIdx + 1) / totalItems) * 100) : 50
  const activeLabel = isPdfMode ? `Page ${activeTopicIdx + 1} of ${totalItems}` : (topics[activeTopicIdx] || "Course Topic")
  
  const focusDot = classFocus >= 80 ? "bg-emerald-500" : classFocus >= 65 ? "bg-amber-500" : "bg-rose-500"
  const focusText = classFocus >= 80 ? "text-emerald-400" : classFocus >= 65 ? "text-amber-400" : "text-rose-400"

  /* ═══ ENTRY OVERLAY ═══ */
  if (!hasEntered) {
    return (
      <div className="fixed inset-0 bg-[#08080A] z-[99] flex flex-col items-center justify-center text-center p-6 font-sans antialiased">
        <style>{`
          @keyframes ep{0%,100%{box-shadow:0 0 20px rgba(147,51,234,.15)}50%{box-shadow:0 0 40px rgba(147,51,234,.35)}}
          @keyframes fu{0%{opacity:0;transform:translateY(20px)}100%{opacity:1;transform:translateY(0)}}
          .ef{animation:fu .6s cubic-bezier(.16,1,.3,1) forwards}
          .efd{animation:fu .6s cubic-bezier(.16,1,.3,1) .15s forwards;opacity:0}
          .efd2{animation:fu .6s cubic-bezier(.16,1,.3,1) .3s forwards;opacity:0}
        `}</style>
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff02_1px,transparent_1px),linear-gradient(to_bottom,#ffffff02_1px,transparent_1px)] bg-[size:48px_48px] pointer-events-none" />
        <div className="relative z-10 max-w-sm w-full space-y-8">
          <div className="ef flex flex-col items-center gap-5">
            <div className="h-20 w-20 rounded-3xl bg-gradient-to-tr from-purple-600 to-indigo-500 flex items-center justify-center border border-purple-400/20" style={{ animation: "ep 3s ease-in-out infinite" }}>
              <Brain className="h-10 w-10 text-white" />
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-black text-white tracking-tight">Ready to begin?</h1>
              <p className="text-xs text-white/35 leading-relaxed">{isParsingPdf ? "Loading PDF..." : "Your AI-powered classroom is prepared"}</p>
            </div>
          </div>
          <div className="efd bg-[#111113] border border-white/[.06] rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-black uppercase tracking-[.15em] text-purple-400">Session</span>
              <span className="text-[10px] font-mono font-bold text-white/30 bg-white/[.03] px-2 py-0.5 rounded">{sessionCode}</span>
            </div>
            <h3 className="text-sm font-bold text-white">{sessionTitle}</h3>
            <p className="text-[11px] text-white/40">{sessionSubject} • {isPdfMode ? `${pdfPages.length} Pages` : `${topics.length} topics`} • {teachingMode} Mode</p>
            <div className="flex items-center gap-2 pt-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] text-emerald-400/80 font-semibold">6 students connected</span>
            </div>
          </div>
          <button id="enter-classroom-btn" disabled={isParsingPdf} onClick={handleEnterClassroom} className="efd2 w-full py-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 rounded-2xl text-sm font-black uppercase text-white tracking-widest transition-all shadow-lg shadow-purple-600/20 active:scale-[.98] cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
            <Play className="h-4 w-4 fill-current" /> {isParsingPdf ? "Loading..." : "Enter Classroom"}
          </button>
          <p className="text-[10px] text-white/20">Click to enable audio • M=mic V=video H=hand C=chat</p>
        </div>
      </div>
    )
  }


  /* ═══════════════════════════════════════════
     FULL CLASSROOM — PRODUCTION LAYOUT
     ═══════════════════════════════════════════ */
  return (
    <div className="fixed inset-0 bg-[#0A0A0A] text-white flex flex-col font-sans antialiased overflow-hidden select-none z-50">
      <style>{`
        @keyframes orbPulse {
          0% { box-shadow: 0 0 0 0 rgba(124,58,237,0.7); }
          70% { box-shadow: 0 0 0 20px rgba(124,58,237,0); }
          100% { box-shadow: 0 0 0 0 rgba(124,58,237,0); }
        }
        @keyframes orbInner {
          0%,100% { box-shadow: inset 0 0 20px rgba(124,58,237,0.2), 0 0 15px rgba(124,58,237,0.25); }
          50% { box-shadow: inset 0 0 30px rgba(124,58,237,0.35), 0 0 30px rgba(124,58,237,0.4); }
        }
        .orb-active {
          animation: orbPulse 2s ease-out infinite, orbInner 2.5s ease-in-out infinite;
        }
        .orb-idle {
          box-shadow: inset 0 0 8px rgba(124,58,237,0.05);
        }

        @keyframes wv { 0%,100%{transform:scaleY(.12)} 50%{transform:scaleY(1)} }
        .wv{animation:wv .6s ease-in-out infinite}
        .wv-1{animation-delay:.08s} .wv-2{animation-delay:.2s} .wv-3{animation-delay:.03s}
        .wv-4{animation-delay:.26s} .wv-5{animation-delay:.13s}

        @keyframes tileGlow {
          0%,100%{border-color:rgba(124,58,237,.4);box-shadow:0 0 20px rgba(124,58,237,.12),0 0 40px rgba(124,58,237,.05)}
          50%{border-color:rgba(124,58,237,.65);box-shadow:0 0 25px rgba(124,58,237,.2),0 0 50px rgba(124,58,237,.08)}
        }
        .tile-glow{animation:tileGlow 2.5s ease-in-out infinite}

        @keyframes imgIn { 0%{opacity:0} 100%{opacity:1} }
        .img-in{animation:imgIn .6s ease-out forwards}
        .img-out{opacity:0;transition:opacity .3s}

        @keyframes slideUp { 0%{transform:translateY(6px);opacity:0} 100%{transform:translateY(0);opacity:1} }
        .slide-up{animation:slideUp .25s ease-out}

        .cscroll::-webkit-scrollbar{width:3px}
        .cscroll::-webkit-scrollbar-track{background:transparent}
        .cscroll::-webkit-scrollbar-thumb{background:rgba(255,255,255,.06);border-radius:10px}
      `}</style>

      {/* ═══ TOP BAR ═══ */}
      <header className="h-14 bg-[#111111] border-b border-white/[.06] px-5 flex items-center justify-between flex-shrink-0 z-30">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center border border-purple-400/20">
            <Brain className="h-4 w-4 text-white" />
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-black text-white leading-none">Class<span className="text-purple-400">AI</span></span>
            <span className="text-[10px] text-white/35 font-semibold tracking-wide uppercase truncate max-w-[140px] mt-0.5">{sessionTitle}</span>
          </div>
        </div>
        <div className="flex flex-col items-center gap-1.5 w-72">
          <div className="flex items-center gap-2 text-xs text-white/70 font-medium">
            <span className="text-purple-400 font-bold uppercase text-[9px] tracking-wider">{isPdfMode ? "PDF Page " : "Topic "} {activeTopicIdx + 1}/{totalItems}:</span>
            <span className="truncate max-w-[160px]">{activeLabel}</span>
          </div>
          <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-purple-600 to-indigo-500 rounded-full transition-all duration-700" style={{ width: `${progressPct}%` }} />
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs font-semibold">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[.02] border border-white/5">
            <span className={`h-2 w-2 rounded-full ${focusDot} animate-pulse`} />
            <span className="text-white/40">Focus:</span>
            <span className={focusText}>{classFocus}%</span>
          </div>
          <div className="flex items-center gap-2.5 bg-white/[.02] border border-white/5 px-3 py-1.5 rounded-lg font-mono text-white/80">
            <Clock className="h-3.5 w-3.5 text-white/30" />
            <span>{fmt(elapsedSeconds)}</span>
            <span className="border-l border-white/10 pl-2.5 flex items-center gap-1">
              <Users className="h-3.5 w-3.5 text-purple-400" />{students.length}
            </span>
          </div>
          {isTeacher && (
            <button id="end-session-btn" onClick={() => setShowEndModal(true)} className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl transition-colors cursor-pointer text-xs font-bold">End Session</button>
          )}
        </div>
      </header>

      {/* ═══ MAIN AREA ═══ */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0">

        {/* ─── LEFT 70% ─── */}
        <div className="w-full lg:w-[70%] flex flex-col p-4 gap-3 min-h-[50vh] lg:min-h-0 pb-4 lg:pb-[84px] shrink-0 overflow-hidden">

          {/* ── STUDENT TILES GALLERY (TOP) ── */}
          <div className="flex-none flex flex-col mb-2">
            <h4 className="text-[10px] font-black uppercase tracking-[.12em] text-white/50 pb-2.5 mb-2.5 border-b border-white/[.06] flex items-center justify-between flex-shrink-0">
              <span>In Class ({students.length})</span>
              <span className="text-emerald-400 flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[9px] font-bold">Active</span>
              </span>
            </h4>
            <div className="flex overflow-x-auto gap-3 pb-2 snap-x cscroll">
              {/* Local User Tile */}
              <div className={`w-48 md:w-64 lg:w-72 shrink-0 snap-center relative aspect-video rounded-xl border ${localMetrics.status === "focused" ? "border-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.35)]" : localMetrics.status === "distracted" ? "border-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.35)]" : localMetrics.status === "away" ? "border-rose-500 shadow-[0_0_8px_rgba(239,68,68,0.35)]" : "border-gray-600"} bg-[#14141b] overflow-hidden transition-all duration-500`}>
                <div className="absolute inset-0 z-0">
                  <StudentCamera
                    sessionCode={sessionCode}
                    studentId={studentId}
                    enabled={videoOn}
                    isGridMode={true}
                    onLocalFocusUpdate={setLocalMetrics}
                    onStreamReady={handleStreamReady}
                  />
                </div>
                <div className="absolute bottom-2 left-2 px-2.5 py-1 rounded-md bg-black/60 backdrop-blur-md border border-white/10 flex items-center justify-center text-[10px] font-medium text-white shadow-black drop-shadow-md z-10">
                  {isTeacher ? "Teacher (You)" : "You"}
                </div>
              </div>

              {/* Other Students */}
              {students.filter(s => s.id !== studentId).map((student: any) => {
                const score = student.engagementScore ?? student.score ?? 0;
                const status = student.status ?? student.state ?? "offline";

                const ringColor = 
                  status === "focused" ? "border-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.35)]" :
                  status === "distracted" ? "border-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.35)]" :
                  status === "away" ? "border-rose-500 shadow-[0_0_8px_rgba(239,68,68,0.35)]" :
                  "border-gray-600";
                
                return (
                  <div key={student.id} className={`w-48 md:w-64 lg:w-72 shrink-0 snap-center relative aspect-video rounded-xl border ${ringColor} bg-[#14141b] flex flex-col items-center justify-center transition-all duration-500 overflow-hidden`}>
                    {remoteStreams[student.id] ? (
                      <video 
                        autoPlay 
                        playsInline 
                        className="absolute inset-0 w-full h-full object-cover z-0"
                        ref={node => {
                          if (node && node.srcObject !== remoteStreams[student.id]) {
                            node.srcObject = remoteStreams[student.id];
                          }
                        }}
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-[#1e1e2e] border border-white/5 flex items-center justify-center text-sm font-bold text-white/60 relative z-10 shadow-lg">
                        {student.name?.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase() || "?"}
                      </div>
                    )}
                    <span className="absolute bottom-2 left-2 px-2.5 py-1 rounded-md bg-black/60 backdrop-blur-md border border-white/10 text-[10px] font-medium text-white shadow-black drop-shadow-md z-10 truncate max-w-[80%]">
                      {student.name || "Student"}
                    </span>
                    <div className="absolute top-2 right-2 px-2 py-0.5 rounded bg-[#0a0a0f]/80 backdrop-blur-md border border-white/10 flex items-center justify-center text-[10px] font-mono text-white/80 z-10 gap-1.5">
                      <div className={`w-1.5 h-1.5 rounded-full ${status === "focused" ? "bg-emerald-500" : status === "distracted" ? "bg-amber-500" : status === "away" ? "bg-rose-500" : "bg-gray-500"}`} />
                      {score}%
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── AI TILE ── */}
          <div
            className={`rounded-2xl border-2 p-5 flex gap-5 flex-shrink-0 transition-all duration-500 relative ${
              aiSpeechState === "speaking" ? "bg-[#131316] tile-glow"
              : aiSpeechState === "paused" ? "bg-[#131316] border-amber-500/20"
              : "bg-[#111111] border-white/[.06]"
            }`}
            style={{ minHeight: 180 }}
          >
            {/* LIVE badge */}
            <div className="absolute top-4 right-4 flex items-center gap-1.5 bg-red-950/40 border border-red-500/20 px-2.5 py-1 rounded-full z-10">
              <span className="h-[6px] w-[6px] rounded-full bg-red-500 animate-pulse" />
              <span className="text-[8px] font-black text-red-400 uppercase tracking-[.15em]">Live</span>
            </div>

            {/* LEFT — orb + waveform */}
            <div className="flex flex-col items-center gap-3 flex-shrink-0 justify-center">
              <div
                className={`rounded-full flex items-center justify-center border-2 transition-all duration-500 ${
                  aiSpeechState === "speaking"
                    ? "bg-gradient-to-br from-purple-600 via-violet-500 to-indigo-600 border-purple-400/30 orb-active"
                    : aiSpeechState === "paused"
                    ? "bg-gradient-to-br from-purple-700/50 via-violet-600/50 to-indigo-700/50 border-amber-500/20 orb-idle"
                    : "bg-[#1a1a1e] border-white/[.08] orb-idle"
                }`}
                style={{ width: 80, height: 80 }}
              >
                <Brain className={`transition-all duration-300 ${
                  aiSpeechState === "speaking" ? "text-white h-8 w-8" : aiSpeechState === "paused" ? "text-white/50 h-7 w-7" : "text-white/20 h-7 w-7"
                }`} />
              </div>
              <div className="flex items-end justify-center gap-[3px] h-5 w-12">
                {aiSpeechState === "speaking"
                  ? [1,2,3,4,5].map((i) => <div key={i} className={`w-[3px] rounded-full bg-purple-400 wv wv-${i}`} style={{height:"100%"}} />)
                  : [1,2,3,4,5].map((i) => <div key={i} className="w-[3px] h-[3px] rounded-full bg-white/8" />)
                }
              </div>
            </div>

            {/* RIGHT — name, topic, transcript */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden gap-1">
              <h3 className="text-lg font-black text-white leading-tight">Professor AI</h3>
              <span className={`text-xs font-bold transition-colors duration-300 ${
                aiSpeechState === "speaking" ? "text-purple-400" : aiSpeechState === "paused" ? "text-amber-400" : "text-white/20"
              }`}>
                {aiSpeechState === "speaking" ? activeLabel : aiSpeechState === "paused" ? "Paused" : "Waiting to begin..."}
              </span>

              {/* Transcript — max ~3 lines visible, scroll, gradient fade at bottom */}
              <div className="flex-1 relative mt-2 min-h-0 overflow-hidden">
                <div className="absolute inset-0 overflow-y-auto cscroll pr-2" style={{ maskImage: "linear-gradient(to bottom, black 60%, transparent 100%)", WebkitMaskImage: "linear-gradient(to bottom, black 60%, transparent 100%)" }}>
                  {pastTranscripts.map((pt, i) => (
                    <p key={i} style={{ fontSize: 15, lineHeight: 1.6 }} className="text-white/20 mb-1.5">{pt}</p>
                  ))}
                  {transcript && (
                    <p style={{ fontSize: 15, lineHeight: 1.6 }} className={`font-medium transition-colors duration-300 ${
                      aiSpeechState === "speaking" ? "text-purple-300" : "text-white/35"
                    }`}>{transcript}</p>
                  )}
                  {!transcript && !pastTranscripts.length && (
                    <p style={{ fontSize: 15, lineHeight: 1.6 }} className="text-white/12 italic">Transcript appears when the lecture starts...</p>
                  )}
                  <div ref={transcriptEndRef} />
                </div>
              </div>
            </div>
          </div>

          {/* ── CONTENT AREA — fills remaining height ── */}
          <div className="flex-1 bg-[#111111] rounded-2xl overflow-hidden flex flex-col relative min-h-0 border border-white/[.06]">
            {/* Image / Fallback — fills entire area */}
            <div className="flex-1 relative overflow-hidden min-h-0">
              {topicImageUrl && imageLoaded ? (
                <div className={`absolute inset-0 ${imageFading ? "img-out" : "img-in"}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={topicImageUrl}
                    alt={activeLabel}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    onError={() => { setImageLoaded(false); setTopicImageUrl(null) }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/10" />
                </div>
              ) : (
                /* Gradient fallback — no broken image icon */
                <div className="absolute inset-0 bg-gradient-to-br from-[#1a1028] via-[#111118] to-[#0d1117] flex items-center justify-center">
                  <div className="text-center space-y-3 px-8">
                    <h2 className="text-2xl font-black text-white/50 tracking-tight">{activeLabel}</h2>
                    <p className="text-sm text-white/20">{isPdfMode ? "Page" : "Topic"} {activeTopicIdx + 1} of {totalItems}</p>
                  </div>
                </div>
              )}
            </div>
            {/* Caption bar */}
            <div className="h-11 border-t border-white/[.06] bg-[#0E0E10] flex items-center justify-between px-5 flex-shrink-0 relative z-10">
              <span className="text-xs font-semibold text-white/50 truncate max-w-[80%]">{activeLabel}</span>
              <span className="px-2 py-0.5 rounded bg-purple-500/10 border border-purple-500/15 text-[8px] font-black text-purple-400 uppercase tracking-[.12em]">IMAGE</span>
            </div>
          </div>
        </div>

        {/* ─── RIGHT 30% ─── */}
        <aside className="w-full lg:w-[30%] flex-1 border-t lg:border-t-0 lg:border-l border-white/[.06] bg-[#0A0A0A] flex flex-col min-h-0 pb-[84px] lg:pb-0">

          {/* ── DOUBT CHAT ── */}
          <div className="flex-1 p-4 flex flex-col overflow-hidden min-h-0">
            <h4 className="text-[10px] font-black uppercase tracking-[.12em] text-white/50 pb-2.5 mb-2 border-b border-white/[.06] flex items-center justify-between flex-shrink-0">
              <span className="flex items-center gap-1.5">
                <MessageSquare className="h-3 w-3 text-purple-400" />
                Doubt Chat
              </span>
              <span className="flex items-center gap-1">
                <span className="h-[6px] w-[6px] rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-emerald-400 text-[8px] font-bold">Live</span>
              </span>
            </h4>
            <div className="flex-1 overflow-y-auto cscroll space-y-2 pr-1 flex flex-col min-h-0">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex flex-col gap-0.5 max-w-[90%] slide-up ${msg.isAI ? "self-start" : "self-end items-end"}`}>
                  <span className="text-[8px] text-white/15 font-bold">{msg.sender} • {msg.time}</span>
                  <div className={`text-[11px] px-3 py-2 rounded-xl leading-relaxed ${
                    msg.isAI
                      ? "bg-[#151517] text-white/80 border border-white/[.05] rounded-tl-none flex gap-1.5 items-start"
                      : "bg-purple-600 text-white rounded-tr-none"
                  }`}>
                    {msg.isAI && <Brain className="h-3 w-3 text-purple-400 flex-shrink-0 mt-0.5" />}
                    <span>{msg.text}</span>
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
            {/* Input — always visible at bottom */}
            <form onSubmit={handleSendDoubt} className="flex gap-2 pt-2.5 border-t border-white/[.06] mt-2 flex-shrink-0">
              <input
                id="doubt-chat-input" type="text" required value={chatInput}
                onChange={(e) => setChatInput(e.target.value)} placeholder={isAnswering ? "Professor is answering..." : "Ask a doubt..."}
                disabled={isAnswering}
                className="flex-1 px-3 py-2 bg-[#1A1A1A] border border-white/8 rounded-xl text-xs focus:outline-none focus:border-purple-500/40 text-white placeholder:text-white/15 disabled:opacity-50"
              />
              <button type="submit" disabled={isAnswering} className="px-3 py-2 bg-purple-600 hover:bg-purple-500 rounded-xl text-white transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
                <Send className="h-3.5 w-3.5" />
              </button>
            </form>
          </div>
        </aside>
      </div>

      {/* ═══ TOOLBAR — single floating pill ═══ */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3">
        <div
          className="flex items-center px-2 rounded-2xl"
          style={{ height: 64, background: "#1A1A1A", backdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,.06)" }}
        >
          {/* Mic */}
          <button id="mic-toggle" onClick={() => { setMicOn(v => !v); addToast(micOn ? "Mic off" : "Mic on") }}
            className={`flex flex-col items-center justify-center gap-0.5 px-3.5 h-full rounded-xl transition-all cursor-pointer ${micOn ? "text-white hover:bg-white/5" : "text-red-400 bg-red-600/10"}`}>
            {micOn ? <Mic className="h-[18px] w-[18px]" /> : <MicOff className="h-[18px] w-[18px]" />}
            <span className="text-[11px] text-white/35 font-medium">Mic</span>
          </button>
          {/* Camera */}
          <button id="camera-toggle" onClick={() => { setVideoOn(v => !v); addToast(videoOn ? "Camera off" : "Camera on") }}
            className={`flex flex-col items-center justify-center gap-0.5 px-3.5 h-full rounded-xl transition-all cursor-pointer ${videoOn ? "text-white hover:bg-white/5" : "text-red-400 bg-red-600/10"}`}>
            {videoOn ? <Video className="h-[18px] w-[18px]" /> : <VideoOff className="h-[18px] w-[18px]" />}
            <span className="text-[11px] text-white/35 font-medium">Camera</span>
          </button>
          {/* Hand */}
          <button id="hand-raise-toggle" onClick={() => { setHandRaised(v => !v); addToast(handRaised ? "Hand lowered" : "Hand raised") }}
            className={`flex flex-col items-center justify-center gap-0.5 px-3.5 h-full rounded-xl transition-all cursor-pointer ${handRaised ? "text-amber-400 bg-amber-600/10" : "text-white/50 hover:bg-white/5"}`}>
            <Hand className="h-[18px] w-[18px]" />
            <span className="text-[11px] text-white/35 font-medium">Hand</span>
          </button>
          {/* Chat */}
          <button onClick={() => setChatOpen(v => !v)}
            className={`flex flex-col items-center justify-center gap-0.5 px-3.5 h-full rounded-xl transition-all cursor-pointer ${chatOpen ? "text-purple-400 bg-purple-600/10" : "text-white/50 hover:bg-white/5"}`}>
            <MessageSquare className="h-[18px] w-[18px]" />
            <span className="text-[11px] text-white/35 font-medium">Chat</span>
          </button>

          {/* Divider */}
          <div className="w-px h-8 bg-white/8 mx-1.5" />

          {/* Teacher-only controls (always rendered for cleaner layout, hidden for students) */}
          {isTeacher && teachingMode === "AI" && (
            <>
              {/* Pause/Resume AI */}
              <button onClick={() => {
                if (aiSpeechState === "speaking") {
                  try { window.speechSynthesis.pause() } catch { /* ok */ }
                  setAiSpeechState("paused"); addToast("AI paused")
                } else {
                  try { window.speechSynthesis.resume() } catch { /* ok */ }
                  setAiSpeechState("speaking"); addToast("AI resumed")
                }
              }}
                className="flex flex-col items-center justify-center gap-0.5 px-3.5 h-full rounded-xl text-white/50 hover:bg-white/5 transition-all cursor-pointer">
                {aiSpeechState === "speaking" ? <Pause className="h-[18px] w-[18px]" /> : <Play className="h-[18px] w-[18px]" />}
                <span className="text-[11px] text-white/35 font-medium">{aiSpeechState === "speaking" ? "Pause" : "Resume"}</span>
              </button>
              {/* Take Over */}
              <button onClick={() => { setTeachingMode("Human"); try { window.speechSynthesis.cancel() } catch { /* ok */ }; setAiSpeechState("idle"); addToast("You took over") }}
                className="flex flex-col items-center justify-center gap-0.5 px-3.5 h-full rounded-xl text-purple-400/70 hover:bg-purple-600/10 transition-all cursor-pointer">
                <Eye className="h-[18px] w-[18px]" />
                <span className="text-[11px] text-white/35 font-medium">Take Over</span>
              </button>
              {/* Record */}
              <button onClick={() => { const v = !isRecording; setIsRecording(v); addToast(v ? "Recording" : "Saved") }}
                className={`flex flex-col items-center justify-center gap-0.5 px-3.5 h-full rounded-xl transition-all cursor-pointer ${isRecording ? "text-red-400 bg-red-600/10" : "text-white/50 hover:bg-white/5"}`}>
                <span className={`h-[18px] w-[18px] flex items-center justify-center`}>
                  <span className={`h-3 w-3 rounded-full ${isRecording ? "bg-red-500 animate-pulse" : "bg-white/20"}`} />
                </span>
                <span className="text-[11px] text-white/35 font-medium">Record</span>
              </button>

              {/* Divider */}
              <div className="w-px h-8 bg-white/8 mx-1.5" />
            </>
          )}

          {/* Voice mute */}
          <button onClick={() => {
            setSpeechEnabled(v => {
              const next = !v
              if (!next) { try { window.speechSynthesis.cancel() } catch { /* ok */ }; setAiSpeechState("idle") }
              addToast(next ? "Voice on" : "Voice muted")
              return next
            })
          }}
            className={`flex flex-col items-center justify-center gap-0.5 px-3.5 h-full rounded-xl transition-all cursor-pointer ${speechEnabled ? "text-white/50 hover:bg-white/5" : "text-red-400 bg-red-600/10"}`}>
            {speechEnabled ? <Volume2 className="h-[18px] w-[18px]" /> : <VolumeX className="h-[18px] w-[18px]" />}
            <span className="text-[11px] text-white/35 font-medium">Voice</span>
          </button>
        </div>

        {/* Leave — separate red pill */}
        <Link href="/dashboard" onClick={() => { try { window.speechSynthesis.cancel() } catch { /* ok */ } }}
          className="flex flex-col items-center justify-center gap-0.5 px-5 rounded-2xl text-red-400 hover:bg-red-600/15 transition-all"
          style={{ height: 64, background: "rgba(220,38,38,.08)", backdropFilter: "blur(20px)", border: "1px solid rgba(239,68,68,.12)" }}>
          <LogOut className="h-[18px] w-[18px]" />
          <span className="text-[11px] font-medium">Leave</span>
        </Link>
      </div>

      {/* ═══ TOASTS ═══ */}
      <div className="fixed bottom-24 left-6 z-[60] flex flex-col gap-2 max-w-xs pointer-events-none">
        {toasts.map((t) => (
          <div key={t.id} className="flex items-center gap-2 bg-[#1A1A1A]/95 border border-white/8 p-3 rounded-xl shadow-2xl slide-up text-xs text-white/80 pointer-events-auto">
            <span>{t.text}</span>
          </div>
        ))}
      </div>

      {/* ═══ END MODAL ═══ */}
      {showEndModal && (
        <div className="fixed inset-0 z-[99] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-[#141416] border border-white/8 w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl">
            <div className="p-6 text-center space-y-4">
              <AlertCircle className="h-10 w-10 text-red-500 mx-auto" />
              <h3 className="font-bold text-white text-base">End this session?</h3>
              <p className="text-xs text-white/40">This will end the lecture for all participants.</p>
            </div>
            <div className="px-6 py-4 border-t border-white/[.04] bg-black/20 flex gap-3">
              <button onClick={() => setShowEndModal(false)} className="flex-1 py-2.5 bg-white/5 rounded-xl text-xs font-bold text-white/50 hover:text-white transition-all cursor-pointer">Cancel</button>
              <button onClick={handleConfirmEnd} className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 rounded-xl text-xs font-bold text-white transition-all cursor-pointer">End Session</button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ END COUNTDOWN ═══ */}
      {endCountdown !== null && (
        <div className="fixed inset-0 bg-[#070708] z-[999] flex flex-col items-center justify-center text-center p-6">
          <Brain className="h-14 w-14 text-purple-400 mx-auto animate-pulse mb-5" />
          <h2 className="text-xl font-black text-white">Session Ended</h2>
          <p className="text-xs text-purple-300/70 font-semibold italic mt-3">&ldquo;Great work today, everyone!&rdquo;</p>
          <p className="text-[10px] text-white/20 mt-4">Returning to dashboard in {endCountdown}s</p>
        </div>
      )}
    </div>
  )
}
