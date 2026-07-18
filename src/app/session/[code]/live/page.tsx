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
  Search,
  MoreHorizontal,
  Loader2,
} from "lucide-react"

import { getFile } from "@/lib/fileStorage"
import { extractDocumentPages } from "@/lib/pdfParser"
import StudentCamera from "@/components/StudentCamera"
import type { FocusMetrics } from "@/hooks/useFocusTracker"
import { subscribeToStudents, subscribeToSession, syncClassroomProgress, setStudentOffline, checkIsIdKicked, checkIsKicked, isStudentRegistered, endSession } from "@/lib/session-service"
import { classroomContext } from "@/lib/classroom-context"

/* ─── MOCK DATA ─── */

const DOUBT_RESPONSES = [
  "Excellent question! In thermodynamics, we define systems as open, closed, or isolated. Energy can cross boundaries in a closed system, but matter cannot.",
  "Great question. Carnot efficiency is the theoretical maximum because it assumes zero friction and perfectly reversible processes.",
  "Entropy can be thought of as the number of microstates available to a system. Higher entropy means more disorder.",
  "Absolute zero is the theoretical lower limit of temperature. The Third Law states you cannot reach it in a finite number of steps.",
]


const renderTranscriptText = (
  text: string,
  inlineImageUrl: string | null,
  isGeneratingImage: boolean,
  imageError: string | null,
  aiSpeechState: string
) => {
  if (!text) return null;
  const parts = text.split(/\n/);
  
  return (
    <div className="space-y-2">
      {parts.map((part, index) => {
        if (part.startsWith("IMAGE_PROMPT:")) {
          const promptText = part.replace("IMAGE_PROMPT:", "").trim();
          return (
            <div key={index} className="my-3 border border-white/5 rounded-xl overflow-hidden bg-black/40 p-3">
              <span className="text-[10px] text-purple-400 font-mono block mb-1">IMAGE PROMPT: {promptText}</span>
              {isGeneratingImage && (
                <div className="h-48 w-full flex items-center justify-center bg-[#151515] rounded-lg">
                  <Loader2 className="animate-spin text-purple-400 h-5 w-5" />
                  <span className="text-xs text-white/50 ml-2">Generating inline visualization via Flux...</span>
                </div>
              )}
              {imageError && (
                <div className="h-48 w-full flex items-center justify-center bg-[#2b1515] rounded-lg border border-red-500/20 px-4 text-center">
                  <span className="text-xs text-red-400 font-medium">⚠️ {imageError}</span>
                </div>
              )}
              {inlineImageUrl && !isGeneratingImage && !imageError && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={inlineImageUrl}
                  alt="Flux visualization"
                  className="rounded-lg max-h-64 object-cover w-full shadow-lg border border-white/10"
                />
              )}
            </div>
          );
        }
        return (
          <p
            key={index}
            style={{ fontSize: 15, lineHeight: 1.6 }}
            className={`font-medium transition-colors duration-300 ${
              aiSpeechState === "speaking" ? "text-purple-300" : "text-white/35"
            }`}
          >
            {part}
          </p>
        );
      })}
    </div>
  );
};

/* ─── COMPONENT ─── */

export default function LiveClassroomPage() {
  const params = useParams()
  const router = useRouter()
  const sessionCode = ((params.code as string) || "UNKNOWN").toUpperCase()

  const [sessionTitle, setSessionTitle] = useState("")
  const [sessionSubject, setSessionSubject] = useState("")
  const [topics, setTopics] = useState<string[]>([])
  const [teachingMode, setTeachingMode] = useState<"AI" | "Human">("AI")
  const [isTeacher, setIsTeacher] = useState(true)
  const isStudent = !isTeacher;
  const [studentId, setStudentId] = useState("unknown-student")
  const [studentName, setStudentName] = useState<string | null>(null)
  const [hasEntered, setHasEntered] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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
  
  // Lecture pause/resume state machine
  const [lecturePlayState, setLecturePlayState] = useState<"PLAYING" | "PAUSED_FOR_DOUBT" | "RESUMING">("PLAYING")
  const lectureAbortRef = useRef<AbortController | null>(null)
  const savedLectureStateRef = useRef<{ topicIdx: number; fullTranscript: string; sentenceBuffer: string; } | null>(null)
  const resumePendingRef = useRef<boolean>(false)

  const prefetchedLectures = useRef<Record<string, { promise: Promise<Response>, time: number, consumed: boolean, fullText?: string }>>({})

  const [transcript, setTranscript] = useState("")
  const [pastTranscripts, setPastTranscripts] = useState<string[]>([])
  const [topicImageUrl, setTopicImageUrl] = useState<string | null>(null)
  const [imageLoaded, setImageLoaded] = useState(false)
  const [imageFading, setImageFading] = useState(false)
  const [lectureHistory, setLectureHistory] = useState<Array<{ role: string, content: string }>>([])
  const [inlineImageUrl, setInlineImageUrl] = useState<string | null>(null)
  const [isGeneratingImage, setIsGeneratingImage] = useState(false)
  const [imageError, setImageError] = useState<string | null>(null)

  const [students, setStudents] = useState<any[]>([])
  const [classFocus, setClassFocus] = useState(0)
  const [localMetrics, setLocalMetrics] = useState<FocusMetrics>({score: 0, status: "offline", gazeDirection: "unknown", faceDetected: false, eyesOpen: false, headYaw: 0, headPitch: 0, headRoll: 0, yawning: false, blinkRate: 0, gazeYaw: 0, gazePitch: 0, irisEngagement: 50, effectiveDeviation: 0, phoneDetected: false})
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({})
  const peerRef = useRef<any>(null)
  const callsRef = useRef<Record<string, any>>({})

  const [chatInput, setChatInput] = useState("")
  const [isAnswering, setIsAnswering] = useState(false)
  const isAnsweringRef = useRef(false)
  const transcriptRef = useRef<string[]>([])
  const [messages, setMessages] = useState(classroomContext.getState().conversationHistory)

  useEffect(() => {
    // Initial welcome message if empty
    if (classroomContext.getState().conversationHistory.length === 0) {
      classroomContext.addMessage({ id: "welcome", sender: "Professor AI", text: "Welcome to today's session. Type any doubts here and I'll pause to answer.", time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }), isAI: true, role: "assistant" })
    }
    const unsubscribe = classroomContext.subscribe((state) => {
      setMessages(state.conversationHistory)
    })
    return unsubscribe
  }, [])
  const chatEndRef = useRef<HTMLDivElement>(null)
  const transcriptEndRef = useRef<HTMLDivElement>(null)

  const [toasts, setToasts] = useState<Array<{ id: string; text: string }>>([])
  const [showEndModal, setShowEndModal] = useState(false)
  const [endCountdown, setEndCountdown] = useState<number | null>(null)

  // --- Immersive Meeting Design States & Refs ---
  const [showToolbar, setShowToolbar] = useState(true)
  const [isParticipantsOpen, setIsParticipantsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [showOnlyActive, setShowOnlyActive] = useState(false)
  const [speakingStudentIds, setSpeakingStudentIds] = useState<Set<string>>(new Set())
  const [showMoreMenu, setShowMoreMenu] = useState(false)

  // Drawer Drag & Hint states
  const [startX, setStartX] = useState(0)
  const [currentX, setCurrentX] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState(0)
  const [showHint, setShowHint] = useState(false)

  const isHoveringToolbarRef = useRef(false)
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const participantsPanelRef = useRef<HTMLDivElement>(null)
  const participantsTabRef = useRef<HTMLButtonElement>(null)
  const moreMenuRef = useRef<HTMLDivElement>(null)
  const drawerRef = useRef<HTMLDivElement>(null)

  // Hydrate hint display from localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      const interacted = localStorage.getItem("hasInteractedParticipants")
      if (!interacted) {
        setShowHint(true)
      }
    }
  }, [])

  // Interaction helper to clear hint
  const handleParticipantsInteraction = useCallback(() => {
    setShowHint(false)
    try {
      localStorage.setItem("hasInteractedParticipants", "true")
    } catch { /* ignore */ }
  }, [])

  // Mouse Drag listeners on window
  useEffect(() => {
    if (!isDragging) return
    const handleMouseMove = (e: MouseEvent) => {
      setCurrentX(e.clientX)
      setDragOffset(e.clientX - startX)
    }
    const handleMouseUp = (e: MouseEvent) => {
      setIsDragging(false)
      const dx = e.clientX - startX
      if (isParticipantsOpen) {
        if (dx > 80) {
          setIsParticipantsOpen(false)
          localStorage.setItem("participantsOpen", "false")
        }
      } else {
        if (dx < -80) {
          setIsParticipantsOpen(true)
          handleParticipantsInteraction()
          localStorage.setItem("participantsOpen", "true")
        }
      }
      setDragOffset(0)
    }
    window.addEventListener("mousemove", handleMouseMove)
    window.addEventListener("mouseup", handleMouseUp)
    return () => {
      window.removeEventListener("mousemove", handleMouseMove)
      window.removeEventListener("mouseup", handleMouseUp)
    }
  }, [isDragging, startX, isParticipantsOpen, handleParticipantsInteraction])

  // Touch Swipe / Drag listeners on window
  useEffect(() => {
    if (!isDragging) return
    const handleTouchMove = (e: TouchEvent) => {
      setCurrentX(e.touches[0].clientX)
      setDragOffset(e.touches[0].clientX - startX)
    }
    const handleTouchEnd = () => {
      setIsDragging(false)
      const dx = currentX - startX
      if (isParticipantsOpen) {
        if (dx > 80) {
          setIsParticipantsOpen(false)
          localStorage.setItem("participantsOpen", "false")
        }
      } else {
        if (dx < -80) {
          setIsParticipantsOpen(true)
          handleParticipantsInteraction()
          localStorage.setItem("participantsOpen", "true")
        }
      }
      setDragOffset(0)
    }
    window.addEventListener("touchmove", handleTouchMove, { passive: true })
    window.addEventListener("touchend", handleTouchEnd)
    return () => {
      window.removeEventListener("touchmove", handleTouchMove)
      window.removeEventListener("touchend", handleTouchEnd)
    }
  }, [isDragging, startX, currentX, isParticipantsOpen, handleParticipantsInteraction])

  // Deterministic student mock features helper
  const getStudentSimulatedProps = useCallback((id: string) => {
    let hash = 0
    for (let i = 0; i < id.length; i++) {
      hash = id.charCodeAt(i) + ((hash << 5) - hash)
    }
    hash = Math.abs(hash)
    const isMuted = (hash % 3) === 0
    const hasHandRaised = (hash % 11) === 0
    const connectionQual = (hash % 10) > 7 ? "Fair" : (hash % 10) > 4 ? "Good" : "Excellent"
    return { isMuted, hasHandRaised, connectionQual }
  }, [])

  const getStudentProps = useCallback((s: any) => {
    const isSelf = s.id === studentId
    if (isSelf) {
      return {
        isMuted: !micOn,
        hasHandRaised: handRaised,
        connectionQual: "Excellent",
      }
    }
    return getStudentSimulatedProps(s.id)
  }, [studentId, micOn, handRaised, getStudentSimulatedProps])

  const getDrawerWidth = useCallback(() => {
    if (drawerRef.current) return drawerRef.current.offsetWidth
    if (typeof window !== "undefined") {
      if (window.innerWidth < 768) return window.innerWidth * 0.85
      if (window.innerWidth < 1024) return 320
    }
    return 360
  }, [])

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    setIsDragging(true)
    setStartX(e.touches[0].clientX)
    setCurrentX(e.touches[0].clientX)
    setDragOffset(0)
  }, [])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setIsDragging(true)
    setStartX(e.clientX)
    setCurrentX(e.clientX)
    setDragOffset(0)
  }, [])

  /* ─── INIT & VALIDATION ─── */
  useEffect(() => {
    let title = "Physics Lab Session"
    let subject = "Physics"
    let storedTopics = null
    let mode = "AI"
    let role = "teacher"
    let storedStudentId = "unknown-student"
    let storedStudentName = "Guest Student"

    try {
      title = localStorage.getItem("sessionTitle") || title
      subject = localStorage.getItem("sessionSubject") || subject
      storedTopics = localStorage.getItem("sessionTopics")
      mode = localStorage.getItem("teachingMode") || mode
      role = localStorage.getItem("userRole") || role
      storedStudentId = localStorage.getItem("studentId") || storedStudentId
      storedStudentName = localStorage.getItem("studentName") || storedStudentName

      const storedParticipantsOpen = localStorage.getItem("participantsOpen")
      setIsParticipantsOpen(storedParticipantsOpen === "true")

      setSessionTitle(title)
      setSessionSubject(subject)
      if (storedTopics) {
        try { setTopics(JSON.parse(storedTopics)) } catch { /* keep default topics */ }
      }
      if (mode === "Human") setTeachingMode("Human")
      setIsTeacher(role === "teacher")
      setStudentId(storedStudentId)
      setStudentName(storedStudentName)
    } catch { /* keep defaults */ }

    // PDF Loading
    const loadPdf = async () => {
      try {
        const file = await getFile("session-pdf")
        if (file) {
          const pages = await extractDocumentPages(file)
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

    // Access Check
    const checkAccess = async () => {
      if (role === "teacher") {
        setLoading(false)
        return
      }

      try {
        // 1. Check if kicked
        const isKickedById = await checkIsIdKicked(sessionCode, storedStudentId)
        if (isKickedById) {
          setError("You have been kicked from this session and cannot rejoin.")
          setLoading(false)
          return
        }

        const isKickedByName = await checkIsKicked(sessionCode, storedStudentName)
        if (isKickedByName) {
          setError("You have been kicked from this session and cannot rejoin.")
          setLoading(false)
          return
        }

        // 2. Check registration status
        const registered = await isStudentRegistered(sessionCode, storedStudentId)
        if (!registered) {
          setError("Access Denied. You did not join during the waiting time or are not registered in this session.")
          setLoading(false)
          return
        }
      } catch (err) {
        console.error("Error verifying student access:", err)
      }
      setLoading(false)
    }

    checkAccess()
  }, [sessionCode])

  // Context Synchronization
  useEffect(() => {
    classroomContext.updateState({
      sessionId: sessionCode,
      subject: sessionSubject,
      topic: topics[activeTopicIdx] || "",
    })
  }, [sessionCode, sessionSubject, topics, activeTopicIdx])

  const addToast = useCallback((text: string) => {
    const id = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
    setToasts((prev) => [...prev, { id, text }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000)
  }, [])



  /* ─── WEB SPEECH ─── */
  const stopSpeaking = useCallback(() => {
    window.speechSynthesis.cancel()
    setAiSpeechState("idle")
  }, [])

  const shouldFlushSpeechBuffer = (buffer: string) => {
    const trimmed = buffer.trim();
    if (!trimmed) return false;
    
    // 1. Hard punctuation
    if (/[.!?](\s|$)/.test(buffer) || buffer.includes("\n")) return true;
    
    const words = trimmed.split(/\s+/);
    const wordCount = words.length;
    
    // 2. Soft punctuation if word count is getting high
    if (wordCount >= 10 && /[,;:](\s|$)/.test(buffer)) return true;
    
    // 3. Fallback: No punctuation, but we hit 18+ words. Wait for a space so we don't cut a word.
    if (wordCount >= 18 && buffer.endsWith(" ")) return true;
    
    return false;
  }


  const speakTextChunk = useCallback((text: string, onEnd?: () => void) => {
    const lines = text.split('\n')
    const filteredText = lines.filter(line => !line.startsWith('IMAGE_PROMPT:')).join('\n').trim()
    if (!filteredText) {
      if (onEnd) onEnd()
      return
    }

    if (!speechEnabled) {
      setAiSpeechState("speaking")
      setLiveSubtitles(filteredText)
      const duration = Math.max(1000, filteredText.split(/\s+/).length * 250)
      setTimeout(() => { setAiSpeechState("idle"); if (onEnd) onEnd() }, duration)
      return
    }
    try {
      const u = new SpeechSynthesisUtterance(filteredText)
      u.volume = 0.55; u.rate = 0.85; u.pitch = 1.0
      u.onstart = () => { setAiSpeechState("speaking"); setLiveSubtitles(filteredText) }
      u.onend = () => { setAiSpeechState("idle"); if (onEnd) onEnd() }
      u.onerror = () => setAiSpeechState("idle")
      speechRef.current = u
      window.speechSynthesis.speak(u)
    } catch { setAiSpeechState("idle") }
  }, [speechEnabled])

  /* ─── PREFETCH LECTURE ─── */
  useEffect(() => {
    if (!loading && !isParsingPdf && topics.length > 0 && sessionSubject !== "" && teachingMode === "AI") {
      const currentTopic = topics[activeTopicIdx] || "";
      const currentItem = isPdfMode && pdfPages.length > 0 ? pdfPages[activeTopicIdx] : currentTopic;
      
      const currentContext = classroomContext.getState();
      if (currentContext.subject !== sessionSubject || currentContext.topic !== currentTopic) {
         classroomContext.updateState({
           sessionId: sessionCode,
           subject: sessionSubject,
           topic: currentTopic,
         });
      }

      const cacheKey = `${sessionCode}_${sessionSubject}_${currentTopic}`;
      if (!prefetchedLectures.current[cacheKey]) {
        console.log(`[Latency] Pre-fetching lecture stream at ${performance.now().toFixed(0)}ms for ${cacheKey}`);
        
        const prompt = isPdfMode 
          ? `Please explain this page of the document: ${currentItem}` 
          : `Please give a detailed lecture explanation for the current topic to the class: ${currentItem}`;
          
        const requestTime = performance.now();
        const { conversationHistory: _ih, ...initialState } = classroomContext.getState();
        const promise = fetch("/api/ai", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question: prompt,
            target: "teacher",
            state: initialState
          })
        }).then(res => {
          if (!res.ok) throw new Error("Fetch failed");
          return res;
        }).catch(err => {
          console.error("Prefetch failed", err);
          throw err;
        });
        
        prefetchedLectures.current[cacheKey] = { promise, time: requestTime, consumed: false };
      }
    }
  }, [loading, isParsingPdf, topics, pdfPages, isPdfMode, teachingMode, sessionSubject, sessionCode, activeTopicIdx]);

  /* ─── AI TEACHING SEQUENCE ─── */
  const runTopicSpeech = useCallback(async (idx: number, resumeFrom?: string) => {
    stopSpeaking()
    
    // Create a new AbortController for this lecture stream
    lectureAbortRef.current?.abort()
    const abortController = new AbortController()
    lectureAbortRef.current = abortController
    
    setLecturePlayState("PLAYING")
    
    const items = isPdfMode ? pdfPages : topics
    if (idx >= items.length) {
      speakTextChunk("That concludes our topics for today. Feel free to review the materials and ask any remaining questions.")
      return
    }
    const currentItem = items[idx]
    
    // Only clear visual states if NOT resuming
    if (!resumeFrom) {
      setInlineImageUrl(null)
      setIsGeneratingImage(false)
      setImageError(null)
      setTopicImageUrl(null)
      setImageLoaded(false)
      setImageFading(false)
      setTranscript("")
    }

    setAiSpeechState("speaking")
    
    let explanation = resumeFrom || ""
    let sentenceBuffer = ""
    let firstTokenTime = 0
    let lastTokenTime = 0

    const reqStartTime = performance.now()
    let cachedTime = reqStartTime;

    const onPlaybackEnd = () => {
      const next = idx + 1
      if (next < items.length) {
        addToast(isPdfMode ? `Moving to Page ${next + 1}` : `Moving to Topic ${next + 1}`)
        setActiveTopicIdx(next)
        syncClassroomProgress(sessionCode, next)
        runTopicSpeech(next)
      } else {
        speakTextChunk("That concludes our topics for today. Feel free to review the materials and ask any remaining questions.")
      }
    }

      let retries = 0;
      const MAX_RETRIES = 2;
      let streamCompleted = false;

      while (retries <= MAX_RETRIES && !streamCompleted) {
        try {
          const currentContext = classroomContext.getState();
          const currentTopic = topics[idx] || "";
          if (currentContext.subject !== sessionSubject || currentContext.topic !== currentTopic) {
             classroomContext.updateState({
               sessionId: sessionCode,
               subject: sessionSubject,
               topic: currentTopic,
             });
          }

          const cacheKey = `${sessionCode}_${sessionSubject}_${currentTopic}`;
          const cached = prefetchedLectures.current[cacheKey];

          let res: Response | undefined;

          if (cached && cached.fullText && retries === 0) {
            console.log(`[Latency] Using fully cached text for ${cacheKey}`);
            explanation = cached.fullText;
            setTranscript(explanation);
            speakTextChunk(explanation, onPlaybackEnd);
            streamCompleted = true;
            break;
          } else if (cached && !cached.consumed && retries === 0) {
            console.log(`[Latency] Using pre-fetched promise for stream ${cacheKey}`);
            cachedTime = cached.time;
            cached.consumed = true; // Mark as consumed so it isn't read twice
            res = await cached.promise;
          } else {
            let prompt = isPdfMode 
              ? `Please explain this page of the document: ${currentItem}` 
              : `Please give a detailed lecture explanation for the current topic to the class: ${currentItem}`;

            if (explanation.length > 50) {
               prompt = `${prompt}. Continue exactly from where you left off. Do not repeat what you already said. The last text generated was: "${explanation.slice(-100)}"`;
            }

            const { conversationHistory: _lh, ...lectureState } = classroomContext.getState();
            res = await fetch("/api/ai", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              signal: abortController.signal,
              body: JSON.stringify({
                question: prompt,
                target: "teacher",
                state: lectureState
              })
            })
          }

          if (res && res.ok && res.body) {
            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            
            while (true) {
              if (abortController.signal.aborted) break;
              const { done, value } = await reader.read();
              if (done) break;
              
              const chunk = decoder.decode(value, { stream: true });
              const lines = chunk.split("\n");
              
              for (const line of lines) {
                 if (line.startsWith("data: ") && !line.includes("[DONE]")) {
                    try {
                       const data = JSON.parse(line.slice(6));
                       const delta = data.choices?.[0]?.delta?.content || "";
                       if (delta) {
                          if (firstTokenTime === 0) firstTokenTime = performance.now();
                          explanation += delta;
                          sentenceBuffer += delta;
                          
                          // Update UI immediately
                          setTranscript(explanation);
                          
                          // Check for sentence boundaries to queue speech
                          if (shouldFlushSpeechBuffer(sentenceBuffer)) {
                             speakTextChunk(sentenceBuffer.trim());
                             sentenceBuffer = "";
                          }
                       }
                    } catch (e) {}
                 }
              }
            }
            
            lastTokenTime = performance.now();
            streamCompleted = true;

            // BACKGROUND PREFETCH NEXT TOPIC
            const nextIdx = idx + 1;
            if (nextIdx < items.length) {
              const nextItem = items[nextIdx];
              const nextCacheKey = `${sessionCode}_${sessionSubject}_${nextItem}`;
              if (!prefetchedLectures.current[nextCacheKey]) {
                console.log(`[Latency] Pre-fetching NEXT topic stream at ${performance.now().toFixed(0)}ms for ${nextCacheKey}`);
                const nextPrompt = isPdfMode 
                  ? `Please explain this page of the document: ${nextItem}` 
                  : `Please give a detailed lecture explanation for the current topic to the class: ${nextItem}`;
                
                const { conversationHistory: _ph, ...prefetchState } = classroomContext.getState();
                const nextPromise = fetch("/api/ai", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    question: nextPrompt,
                    target: "teacher",
                    state: { ...prefetchState, topic: nextItem }
                  })
                }).then(r => {
                  if (!r.ok) throw new Error("Prefetch failed");
                  return r;
                }).catch(err => {
                  console.error("Prefetch next topic failed", err);
                  throw err;
                });
                
                prefetchedLectures.current[nextCacheKey] = { promise: nextPromise, time: performance.now(), consumed: false };
              }
            }

            // Flush any remaining speech with the completion callback attached to the last utterance
            if (sentenceBuffer.trim().length > 0) {
               speakTextChunk(sentenceBuffer.trim(), onPlaybackEnd);
            } else {
               // If we already flushed everything perfectly on boundaries, we need to trigger next topic
               onPlaybackEnd();
            }

            // Cache the fully resolved string for immediate playback if user returns to this topic
            if (cached) {
               cached.fullText = explanation;
            }

          } else {
            throw new Error("Bad response from AI Server")
          }
        } catch (e: any) {
          // Intentional abort from doubt pause — exit silently
          if (e?.name === "AbortError" || abortController.signal.aborted) {
            console.log("[Lecture] Stream aborted for doubt pause");
            // Save the current state for resumption
            savedLectureStateRef.current = {
              topicIdx: idx,
              fullTranscript: explanation,
              sentenceBuffer: sentenceBuffer,
            };
            return; // Exit cleanly, no retry
          }
          console.error("AI Lecture fetch failed or interrupted:", e)
          retries++;
          if (retries > MAX_RETRIES) {
             explanation = "Network error. Please try again."
             setTranscript(explanation)
             speakTextChunk(explanation)
             break;
          }
          // wait before retry
          await new Promise(r => setTimeout(r, 1000));
        }
      }

    const totalTimeToFirstToken = firstTokenTime > 0 ? (firstTokenTime - cachedTime) : (lastTokenTime - cachedTime);
    const totalStreamingTime = lastTokenTime - firstTokenTime;
    
    console.log(`[Latency] Time to First Token: ${totalTimeToFirstToken.toFixed(0)}ms | Streaming Duration: ${totalStreamingTime.toFixed(0)}ms`);
    if (idx === 0) {
       addToast(`Latency | TTFT: ${totalTimeToFirstToken.toFixed(0)}ms | Streaming: ${totalStreamingTime.toFixed(0)}ms`);
    }

    transcriptRef.current.push(explanation)
    setPastTranscripts((old) => [...old, explanation])

  }, [topics, pdfPages, isPdfMode, speakTextChunk, stopSpeaking, addToast, sessionCode, sessionSubject])

  /* ─── ENTER CLASSROOM ─── */
  const handleEnterClassroom = useCallback(() => {
    try { window.speechSynthesis.cancel() } catch { /* ok */ }
    setHasEntered(true)
    setLectureHistory([])
    if (teachingMode === "AI") runTopicSpeech(0)
  }, [teachingMode, runTopicSpeech])

  /* ─── CLEANUP: kill speech on unmount (navigation away) ─── */
  useEffect(() => {
    // Add beforeunload to explicitly set student offline in Firebase
    const handleBeforeUnload = () => {
      if (!isTeacher && studentId && sessionCode) {
        setStudentOffline(sessionCode, studentId).catch(() => {});
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    
    return () => {
      try { window.speechSynthesis.cancel() } catch { /* ok */ }
      lectureAbortRef.current?.abort()
      window.removeEventListener("beforeunload", handleBeforeUnload);
      
      if (!isTeacher && studentId && sessionCode) {
        setStudentOffline(sessionCode, studentId).catch(() => {});
      }
    }
  }, [isTeacher, studentId, sessionCode])

  /* ─── TIMER ─── */
  useEffect(() => {
    if (!hasEntered || lecturePlayState === "PAUSED_FOR_DOUBT") return
    const i = setInterval(() => setElapsedSeconds((s) => s + 1), 1000)
    return () => clearInterval(i)
  }, [hasEntered, lecturePlayState])

  /* ─── CLASSROOM SYNC ─── */
  useEffect(() => {
    if (!sessionCode) return
    const unsubscribe = subscribeToSession(
      sessionCode,
      (updated) => {
        if (!updated) return;
        
        // Redirect student to summary page if session completed in database
        if (!isTeacher && updated.status === "Completed") {
          router.push(`/session/${sessionCode}/summary`)
          return
        }

        // Sync topic for students
        if (!isTeacher && updated.currentTopicIndex !== undefined && updated.currentTopicIndex !== activeTopicIdx) {
          setActiveTopicIdx(updated.currentTopicIndex)
        }
      },
      (err) => console.error("Session sync error:", err)
    )
    return () => unsubscribe()
  }, [sessionCode, isTeacher, activeTopicIdx, router])

  /* ─── STUDENTS SIM ─── */
  useEffect(() => {
    if (!hasEntered || !sessionCode) return
    const unsubscribe = subscribeToStudents(
      sessionCode,
      (updated) => {
        // Auto-remove "ghost" students who closed their tab and stopped sending engagement data
        const now = Date.now();
        const activeStudents = updated.filter(s => {
          if (!s.lastActive) return true;
          const lastActiveMs = s.lastActive.toMillis ? s.lastActive.toMillis() : (s.lastActive.seconds * 1000);
          return (now - lastActiveMs) < 15000; // 15 seconds threshold
        });
        
        setStudents(activeStudents)
        if (activeStudents.length > 0) {
          setClassFocus(Math.floor(updated.reduce((a, s) => a + (s.engagementScore || 0), 0) / updated.length))
        }
      },
      (err) => {
        console.error("Failed to sync students in live page:", err)
      }
    )
    return () => unsubscribe()
  }, [hasEntered, sessionCode])

  // Use a ref to access the latest localStream inside LiveKit callbacks
  const localStreamRef = useRef<MediaStream | null>(null);
  useEffect(() => {
    localStreamRef.current = localStream;
  }, [localStream]);

  const [livekitToken, setLivekitToken] = useState<string | null>(null);

  // Fetch LiveKit Token
  useEffect(() => {
    if (!hasEntered || !sessionCode || !studentId) return;
    fetch('/api/livekit/token', {
      method: 'POST',
      body: JSON.stringify({ sessionCode, studentId, isTeacher }),
      headers: { 'Content-Type': 'application/json' }
    })
    .then(r => r.json())
    .then(data => {
      if (data.token) setLivekitToken(data.token);
    })
    .catch(console.error);
  }, [hasEntered, sessionCode, studentId, isTeacher]);

  /* ─── LIVEKIT SFU INIT ─── */
  const roomRef = useRef<any>(null);

  useEffect(() => {
    if (!hasEntered || !studentId || !livekitToken) return;

    let room: any;
    const initLiveKit = async () => {
      const { Room, RoomEvent } = await import('livekit-client');
      room = new Room();
      roomRef.current = room;

      room.on(RoomEvent.TrackSubscribed, (track: any, publication: any, participant: any) => {
        if (track.kind === 'video') {
           const stream = new MediaStream([track.mediaStreamTrack]);
           setRemoteStreams(prev => ({ ...prev, [participant.identity]: stream }));
        }
      });

      room.on(RoomEvent.TrackUnsubscribed, (track: any, publication: any, participant: any) => {
        if (track.kind === 'video') {
           setRemoteStreams(prev => {
             const copy = { ...prev };
             delete copy[participant.identity];
             return copy;
           });
        }
      });

      room.on(RoomEvent.ActiveSpeakersChanged, (speakers: any[]) => {
        const identities = speakers.map(s => s.identity);
        setSpeakingStudentIds(new Set(identities));
      });

      try {
        const livekitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;
        if (!livekitUrl) {
          console.error("NEXT_PUBLIC_LIVEKIT_URL is missing!");
          return;
        }
        await room.connect(livekitUrl, livekitToken);
        console.log("Joined LiveKit room successfully!");

        if (localStreamRef.current) {
          const videoTrack = localStreamRef.current.getVideoTracks()[0];
          if (videoTrack) {
            const { LocalVideoTrack } = await import('livekit-client');
            const localTk = new LocalVideoTrack(videoTrack);
            await room.localParticipant.publishTrack(localTk);
          }
        }
      } catch (err) {
        console.error("LiveKit connection error:", err);
      }
    };
    initLiveKit();

    return () => {
      if (room) room.disconnect();
    };
  }, [hasEntered, studentId, livekitToken]);

  // Update LiveKit's video track when localStream changes AFTER initialization
  useEffect(() => {
    if (roomRef.current && localStream && roomRef.current.state === 'connected') {
      const publishTrackAsync = async () => {
        const videoTrack = localStream.getVideoTracks()[0];
        if (videoTrack) {
          const { LocalVideoTrack } = await import('livekit-client');
          const localTk = new LocalVideoTrack(videoTrack);
          
          const existingPublications = roomRef.current.localParticipant.videoTrackPublications;
          for (const pub of existingPublications.values()) {
            if (pub.track) {
              await roomRef.current.localParticipant.unpublishTrack(pub.track);
            }
          }
          
          await roomRef.current.localParticipant.publishTrack(localTk);
        }
      };
      publishTrackAsync();
    }
  }, [localStream]);

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
    
    // Stop any active narration immediately (lecture or previous doubt voice)
    try { window.speechSynthesis.cancel() } catch { /* ok */ }
    setAiSpeechState("idle")
    resumePendingRef.current = false // Reset resume pending since we got a new question
    
    const question = chatInput.trim()
    const userMsgId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
    const userMsg = { id: userMsgId, sender: "You", text: question, time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }), isAI: false, role: "user" as const }
    classroomContext.addMessage(userMsg)
    setChatInput("")
    
    // === PAUSE LECTURE ===
    if (lecturePlayState === "PLAYING") {
      // Abort active lecture stream
      lectureAbortRef.current?.abort()
      setLecturePlayState("PAUSED_FOR_DOUBT")
    }
    
    try {
      const currentContext = classroomContext.getState();

      const { conversationHistory: _dh, ...doubtState } = currentContext;
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          question: question,
          target: "doubt-chat",
          sessionId: sessionCode,
          studentId: studentId,
          state: {
            ...doubtState,
            currentSlideText: isPdfMode && pdfPages.length > 0 ? pdfPages[activeTopicIdx] : undefined
          }
        })
      })

      if (res.ok && res.body) {
        const msgId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
        classroomContext.addMessage({ id: msgId, sender: "Professor AI", text: "", time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }), isAI: true, role: "assistant" as const })
        
        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let answerText = ""
        
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          
          const chunk = decoder.decode(value, { stream: true })
          const lines = chunk.split("\n")
          
          for (const line of lines) {
             if (line.startsWith("data: ") && !line.includes("[DONE]")) {
                try {
                   const data = JSON.parse(line.slice(6))
                   const delta = data.choices?.[0]?.delta?.content || ""
                   if (delta) {
                      answerText += delta
                      classroomContext.updateMessage(msgId, { text: answerText })
                   }
                } catch (e) {}
             }
          }
        }

        // Play the generated audio automatically
        speakTextChunk(answerText, () => {
          // Resume class automatically when doubt explanation ends
          resumePendingRef.current = false;
          const saved = savedLectureStateRef.current;
          if (saved) {
            savedLectureStateRef.current = null;
            setLecturePlayState("RESUMING");
            runTopicSpeech(saved.topicIdx, saved.fullTranscript);
          } else {
            setLecturePlayState("PLAYING");
            runTopicSpeech(activeTopicIdx);
          }
        });

      } else {
        const errData = await res.text()
        console.error("Doubt Chat API Error:", errData)
        addToast("Sorry, I encountered an error answering that.")
      }
    } catch (e) {
      console.error("Doubt Chat fetch failed:", e)
      addToast("Network error. Please try again.")
    }

    isAnsweringRef.current = false
    setIsAnswering(false)
    // NOTE: Lecture remains PAUSED. Student must click "Resume Lecture".
  }

  /* ─── RESUME LECTURE ─── */
  const handleResumeLecture = useCallback(() => {
    // If the professor is still speaking the doubt response, wait until it finishes
    if (window.speechSynthesis.speaking) {
      resumePendingRef.current = true;
      setLecturePlayState("RESUMING");
      return;
    }
    
    const saved = savedLectureStateRef.current;
    if (!saved) {
      // No saved state — just restart current topic
      setLecturePlayState("PLAYING")
      runTopicSpeech(activeTopicIdx)
      return
    }
    
    setLecturePlayState("RESUMING")
    savedLectureStateRef.current = null;
    
    // Resume from exact position with continuation prompt
    runTopicSpeech(saved.topicIdx, saved.fullTranscript)
  }, [activeTopicIdx, runTopicSpeech])

  const handleConfirmEnd = async () => {
    setShowEndModal(false)
    setEndCountdown(5)
    try {
      window.speechSynthesis.cancel()
    } catch { /* ok */ }

    try {
      await endSession(sessionCode)
    } catch (e) {
      console.warn("Failed to end session in database:", e)
    }
  }

  useEffect(() => {
    if (endCountdown === null) return
    if (endCountdown === 0) { 
      // Explicitly disconnect from LiveKit and stop all tracks to ensure camera light turns off
      if (roomRef.current) {
        roomRef.current.disconnect();
      }
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(t => t.stop());
      }
      if (isTeacher) {
        router.push(`/session/${sessionCode}/summary`)
      } else {
        router.push("/dashboard")
      }
      return 
    }
    const t = setTimeout(() => setEndCountdown((c) => (c !== null ? c - 1 : null)), 1000)
    return () => clearTimeout(t)
  }, [endCountdown, router, isTeacher, sessionCode])

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

  // --- Auto-Hide Toolbar Effect ---
  useEffect(() => {
    if (!hasEntered) return

    const triggerShow = () => {
      setShowToolbar(true)
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current)
        hideTimeoutRef.current = null
      }
    }

    const triggerHideWithDelay = () => {
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current)
      hideTimeoutRef.current = setTimeout(() => {
        if (!isHoveringToolbarRef.current) {
          setShowToolbar(false)
        }
      }, 2000)
    }

    const handleMouseMove = (e: MouseEvent) => {
      if (e.clientY >= window.innerHeight - 60) {
        triggerShow()
      } else {
        if (!isHoveringToolbarRef.current) {
          triggerHideWithDelay()
        }
      }
    }

    const handleTouchStart = () => {
      triggerShow()
      triggerHideWithDelay()
    }

    window.addEventListener("mousemove", handleMouseMove)
    window.addEventListener("touchstart", handleTouchStart)
    
    triggerHideWithDelay()

    return () => {
      window.removeEventListener("mousemove", handleMouseMove)
      window.removeEventListener("touchstart", handleTouchStart)
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current)
    }
  }, [hasEntered])

  // --- Collapsible Panel Outside Click & Escape Hook ---
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (
        isParticipantsOpen &&
        participantsPanelRef.current &&
        !participantsPanelRef.current.contains(e.target as Node) &&
        participantsTabRef.current &&
        !participantsTabRef.current.contains(e.target as Node)
      ) {
        setIsParticipantsOpen(false)
        localStorage.setItem("participantsOpen", "false")
      }

      if (
        showMoreMenu &&
        moreMenuRef.current &&
        !moreMenuRef.current.contains(e.target as Node)
      ) {
        setShowMoreMenu(false)
      }
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (isParticipantsOpen) {
          setIsParticipantsOpen(false)
          localStorage.setItem("participantsOpen", "false")
        }
        if (showMoreMenu) {
          setShowMoreMenu(false)
        }
      }
    }

    document.addEventListener("mousedown", handleOutsideClick)
    window.addEventListener("keydown", handleKeyDown)

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick)
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [isParticipantsOpen, showMoreMenu])

  // --- Active Speaker Simulation Sequence ---
  useEffect(() => {
    if (!hasEntered) return
    const interval = setInterval(() => {
      if (students.length === 0) return
      const speakCount = Math.floor(Math.random() * 2) + 1
      const newSpeaking = new Set<string>()
      for (let i = 0; i < speakCount; i++) {
        const randomStudent = students[Math.floor(Math.random() * students.length)]
        if (randomStudent && randomStudent.id) {
          newSpeaking.add(randomStudent.id)
        }
      }
      setSpeakingStudentIds(newSpeaking)
    }, 7000)

    return () => clearInterval(interval)
  }, [hasEntered, students])

  const fmt = (s: number) => `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`
  const totalItems = isPdfMode ? pdfPages.length : topics.length
  const progressPct = totalItems > 0 ? Math.floor(((activeTopicIdx + 1) / totalItems) * 100) : 50
  const activeLabel = isPdfMode ? `Page ${activeTopicIdx + 1} of ${totalItems}` : (topics[activeTopicIdx] || "Course Topic")
  
  const focusDot = classFocus >= 80 ? "bg-emerald-500" : classFocus >= 65 ? "bg-amber-500" : "bg-rose-500"
  const focusText = classFocus >= 80 ? "text-emerald-400" : classFocus >= 65 ? "text-amber-400" : "text-rose-400"

  // ─── LOADING SCREEN ───
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex flex-col items-center justify-center text-white font-sans">
        <div className="h-8 w-8 rounded-full border-2 border-purple-500 border-t-transparent animate-spin mb-4" />
        <p className="text-sm text-white/60">Verifying session access...</p>
      </div>
    )
  }

  // ─── ERROR SCREEN ───
  if (error) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex flex-col items-center justify-center text-white font-sans p-6 text-center">
        <AlertCircle className="h-10 w-10 text-red-500 mb-4" />
        <h2 className="text-lg font-bold mb-2">Access Denied</h2>
        <p className="text-sm text-white/50 mb-6 max-w-sm">{error}</p>
        <Link
          href="/dashboard"
          className="px-5 py-2.5 bg-[#1a1a1a] rounded-xl text-xs font-semibold hover:bg-[#242424] border border-white/5 transition-all"
        >
          Return to Dashboard
        </Link>
      </div>
    )
  }

  /* ─── ENTRY OVERLAY ─── */
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


  const drawerWidth = getDrawerWidth()
  let transformStr = "translate3d(100%, 0, 0)"
  let openRatio = 0
  if (isParticipantsOpen) {
    if (isDragging && dragOffset > 0) {
      openRatio = Math.max(0, 1 - dragOffset / drawerWidth)
      transformStr = `translate3d(${Math.min(drawerWidth, dragOffset)}px, 0, 0)`
    } else {
      openRatio = 1
      transformStr = "translate3d(0, 0, 0)"
    }
  } else {
    if (isDragging && dragOffset < 0) {
      openRatio = Math.min(1, -dragOffset / drawerWidth)
      transformStr = `translate3d(${Math.max(0, drawerWidth + dragOffset)}px, 0, 0)`
    } else {
      openRatio = 0
      transformStr = "translate3d(100%, 0, 0)"
    }
  }

  const overlayStyle = {
    opacity: openRatio * 0.25,
    backdropFilter: `blur(${openRatio * 10}px)`,
    WebkitBackdropFilter: `blur(${openRatio * 10}px)`,
    transition: isDragging ? "none" : "opacity 300ms cubic-bezier(0.16, 1, 0.3, 1), backdrop-filter 300ms cubic-bezier(0.16, 1, 0.3, 1)",
    pointerEvents: openRatio > 0.01 ? ("auto" as const) : ("none" as const),
  }

  const filteredStudents = students.filter((s) => {
    const matchesSearch = s.name?.toLowerCase().includes(searchQuery.toLowerCase())
    const isSpeaking = speakingStudentIds.has(s.id)
    const matchesSpeaker = !showOnlyActive || isSpeaking
    return matchesSearch && matchesSpeaker
  })

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

        @keyframes audioRing {
          0% { transform: scale(1); opacity: 1; border-color: rgba(168, 85, 247, 0.85); box-shadow: 0 0 0 0 rgba(168, 85, 247, 0.4); }
          50% { transform: scale(1.08); opacity: 0.5; border-color: rgba(168, 85, 247, 0.4); box-shadow: 0 0 8px 2px rgba(168, 85, 247, 0.2); }
          100% { transform: scale(1.15); opacity: 0; border-color: rgba(168, 85, 247, 0); box-shadow: 0 0 12px 4px rgba(168, 85, 247, 0); }
        }
        .audio-ring {
          position: absolute;
          inset: -2px;
          border: 2px solid rgba(168, 85, 247, 0.65);
          border-radius: 12px;
          animation: audioRing 1.6s cubic-bezier(0.1, 0.8, 0.3, 1) infinite;
          pointer-events: none;
          z-index: 5;
        }

        /* Drawer Overlay */
        .drawer-overlay {
          position: fixed;
          inset: 0;
          z-index: 100;
          background-color: rgba(0, 0, 0, 0.25);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          will-change: opacity, backdrop-filter;
        }

        /* Drawer container */
        .drawer-container {
          position: fixed;
          top: 0;
          right: 0;
          bottom: 0;
          z-index: 110;
          background-color: #0E0E10;
          border-left: 1px solid rgba(255, 255, 255, 0.06);
          box-shadow: -10px 0 30px rgba(0, 0, 0, 0.6);
          will-change: transform;
          width: 85vw;
        }
        @media (min-width: 768px) {
          .drawer-container {
            width: 320px;
          }
        }
        @media (min-width: 1024px) {
          .drawer-container {
            width: 360px;
          }
        }

        /* Drawer handle tab */
        .drawer-handle {
          position: fixed;
          right: 0;
          top: 50%;
          transform: translateY(-50%);
          z-index: 90;
          background-color: #111113;
          border-top: 1px solid rgba(147, 51, 234, 0.3);
          border-left: 1px solid rgba(147, 51, 234, 0.3);
          border-bottom: 1px solid rgba(147, 51, 234, 0.3);
          border-radius: 12px 0 0 12px;
          width: 24px;
          height: 120px;
          cursor: pointer;
          transition: width 0.2s ease, background-color 0.2s ease, box-shadow 0.2s ease;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          box-shadow: -2px 0 15px rgba(124, 58, 237, 0.15);
        }
        .drawer-handle:hover {
          width: 32px;
          background-color: #16161a;
          box-shadow: -4px 0 20px rgba(124, 58, 237, 0.35);
          border-color: rgba(147, 51, 234, 0.5);
        }

        /* Instagram-style Hint Indicator */
        .hint-indicator {
          position: fixed;
          right: 12px;
          top: 50%;
          transform: translateY(-50%);
          z-index: 85;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          pointer-events: none;
        }

        @keyframes hintArrow {
          0%, 100% { transform: translateX(0); opacity: 0.1; }
          50% { transform: translateX(-4px); opacity: 0.7; }
        }
        .hint-arrow {
          animation: hintArrow 2s ease-in-out infinite;
        }
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
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0 relative">

        {/* ─── LEFT COLUMN (AI Instructor & Slides) ─── */}
        <div className="flex-1 flex flex-col p-4 gap-3 min-h-[50vh] lg:min-h-0 pb-4 lg:pb-[84px] overflow-hidden">
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
              <div className={`w-48 md:w-64 lg:w-72 shrink-0 snap-center relative aspect-video rounded-xl border ${
                localMetrics.status === "focused"  ? "border-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.35)]" : 
                localMetrics.status === "distracted" ? "border-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.35)]" : 
                localMetrics.status === "away" ? "border-rose-500 shadow-[0_0_8px_rgba(239,68,68,0.35)]" : 
                localMetrics.status === "sleeping" ? "border-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.35)]" : 
                localMetrics.status === "phone" ? "border-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)] animate-pulse" : 
                "border-gray-600"
              } bg-[#14141b] overflow-hidden transition-all duration-500`}>
                {/* Visual Alert Overlays */}
                {localMetrics.status === "sleeping" && (
                  <div className="absolute inset-0 bg-black/75 z-10 flex flex-col items-center justify-center gap-1.5">
                    <span className="text-2xl">😴</span>
                    <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider">Sleeping Detected</span>
                  </div>
                )}
                {localMetrics.status === "phone" && (
                  <div className="absolute inset-0 bg-red-950/75 z-10 flex flex-col items-center justify-center gap-1.5 border border-red-500 animate-pulse">
                    <span className="text-2xl">📱</span>
                    <span className="text-[10px] font-bold text-red-400 uppercase tracking-wider">Phone Usage Detected</span>
                  </div>
                )}

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
                {/* Focus score badge — visible to all */}
                <div className="absolute top-2 right-2 px-2 py-0.5 rounded bg-[#0a0a0f]/80 backdrop-blur-md border border-white/10 flex items-center justify-center text-[10px] font-mono text-white/80 z-10 gap-1.5">
                  <div className={`w-1.5 h-1.5 rounded-full ${
                    localMetrics.status === "focused"  ? "bg-emerald-500" : 
                    localMetrics.status === "distracted" ? "bg-amber-500" : 
                    localMetrics.status === "away" ? "bg-rose-500" : 
                    localMetrics.status === "sleeping" ? "bg-cyan-400 animate-pulse" : 
                    localMetrics.status === "phone" ? "bg-red-500 animate-ping" : 
                    "bg-gray-500"
                  }`} />
                  {localMetrics.score}%
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
                  status === "focused" || status === "active" ? "border-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.35)]" :
                  status === "distracted" ? "border-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.35)]" :
                  status === "away" ? "border-rose-500 shadow-[0_0_8px_rgba(239,68,68,0.35)]" :
                  status === "sleeping" ? "border-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.35)]" :
                  status === "phone" ? "border-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)] animate-pulse" :
                  "border-gray-600";
                
                return (
                  <div key={student.id} className={`w-48 md:w-64 lg:w-72 shrink-0 snap-center relative aspect-video rounded-xl border ${ringColor} bg-[#14141b] flex flex-col items-center justify-center transition-all duration-500 overflow-hidden`}>
                    {/* Visual Alert Overlays */}
                    {status === "sleeping" && (
                      <div className="absolute inset-0 bg-black/75 z-10 flex flex-col items-center justify-center gap-1.5">
                        <span className="text-2xl">😴</span>
                        <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider">Sleeping Detected</span>
                      </div>
                    )}
                    {status === "phone" && (
                      <div className="absolute inset-0 bg-red-950/75 z-10 flex flex-col items-center justify-center gap-1.5 border border-red-500 animate-pulse">
                        <span className="text-2xl">📱</span>
                        <span className="text-[10px] font-bold text-red-400 uppercase tracking-wider">Phone Usage Detected</span>
                      </div>
                    )}

                    {remoteStreams[student.id] ? (
                      <video 
                        autoPlay 
                        playsInline 
                        muted
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
                      <div className={`w-1.5 h-1.5 rounded-full ${
                        status === "focused" || status === "active" ? "bg-emerald-500" : 
                        status === "distracted" ? "bg-amber-500" : 
                        status === "away" ? "bg-rose-500" : 
                        status === "sleeping" ? "bg-cyan-400 animate-pulse" : 
                        status === "phone" ? "bg-red-500 animate-ping" : 
                        "bg-gray-500"
                      }`} />
                      {score}%
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* AI TILE */}
          <div
            className={`rounded-2xl border-2 p-5 flex gap-5 flex-shrink-0 transition-all duration-500 relative ${
              lecturePlayState === "PAUSED_FOR_DOUBT" ? "bg-[#131316] border-amber-500/30"
              : aiSpeechState === "speaking" ? "bg-[#131316] tile-glow"
              : aiSpeechState === "paused" ? "bg-[#131316] border-amber-500/20"
              : "bg-[#111111] border-white/[.06]"
            }`}
            style={{ minHeight: 180 }}
          >
            {/* LIVE / PAUSED badge */}
            {lecturePlayState === "PAUSED_FOR_DOUBT" ? (
              <div className="absolute top-4 right-4 flex items-center gap-1.5 bg-amber-950/40 border border-amber-500/30 px-2.5 py-1 rounded-full z-10">
                <span className="h-[6px] w-[6px] rounded-full bg-amber-400" />
                <span className="text-[8px] font-black text-amber-400 uppercase tracking-[.12em]">Paused · Answering Doubt</span>
              </div>
            ) : (
              <div className="absolute top-4 right-4 flex items-center gap-1.5 bg-red-950/40 border border-red-500/20 px-2.5 py-1 rounded-full z-10">
                <span className="h-[6px] w-[6px] rounded-full bg-red-500 animate-pulse" />
                <span className="text-[8px] font-black text-red-400 uppercase tracking-[.15em]">Live</span>
              </div>
            )}

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
                {aiSpeechState === "speaking" && lecturePlayState !== "PAUSED_FOR_DOUBT"
                  ? [1,2,3,4,5].map((i) => <div key={i} className={`w-[3px] rounded-full bg-purple-400 wv wv-${i}`} style={{height:"100%"}} />)
                  : [1,2,3,4,5].map((i) => <div key={i} className="w-[3px] h-[3px] rounded-full bg-white/8" />)
                }
              </div>
            </div>

            {/* RIGHT — name, topic, transcript */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden gap-1">
              <h3 className="text-lg font-black text-white leading-tight">Professor AI</h3>
              <span className={`text-xs font-bold transition-colors duration-300 ${
                lecturePlayState === "PAUSED_FOR_DOUBT" ? "text-amber-400"
                : aiSpeechState === "speaking" ? "text-purple-400" : aiSpeechState === "paused" ? "text-amber-400" : "text-white/20"
              }`}>
                {lecturePlayState === "PAUSED_FOR_DOUBT" ? "Paused — Answering your doubt" 
                : aiSpeechState === "speaking" ? activeLabel : aiSpeechState === "paused" ? "Paused" : "Waiting to begin..."}
              </span>

              {/* Transcript — max ~3 lines visible, scroll, gradient fade at bottom */}
              <div className="flex-1 relative mt-2 min-h-0 overflow-hidden">
                <div className="absolute inset-0 overflow-y-auto cscroll pr-2" style={{ maskImage: "linear-gradient(to bottom, black 60%, transparent 100%)", WebkitMaskImage: "linear-gradient(to bottom, black 60%, transparent 100%)" }}>
                  {pastTranscripts.map((pt, i) => (
                    <p key={i} style={{ fontSize: 15, lineHeight: 1.6 }} className="text-white/20 mb-1.5">{pt}</p>
                  ))}
                  {transcript && renderTranscriptText(transcript, inlineImageUrl, isGeneratingImage, imageError, aiSpeechState)}
                  {lecturePlayState === "PAUSED_FOR_DOUBT" && (
                    <p style={{ fontSize: 13, lineHeight: 1.6 }} className="text-amber-400/70 italic mt-2">Lecture paused while answering your question. Press Resume Lecture when you’re ready to continue.</p>
                  )}
                  {!transcript && !pastTranscripts.length && (
                    <p style={{ fontSize: 15, lineHeight: 1.6 }} className="text-white/12 italic">Transcript appears when the lecture starts...</p>
                  )}
                  <div ref={transcriptEndRef} />
                </div>
              </div>
            </div>
          </div>

          {/* CONTENT AREA — fills remaining height */}
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
            <div className="flex flex-col gap-2 pt-2.5 border-t border-white/[.06] mt-2 flex-shrink-0">
              {lecturePlayState === "PAUSED_FOR_DOUBT" && (
                <button
                  type="button"
                  onClick={handleResumeLecture}
                  className="w-full flex items-center justify-center gap-2 py-2 bg-amber-600 hover:bg-amber-500 rounded-xl text-white text-xs font-bold transition-all shadow-lg shadow-amber-900/30"
                >
                  <Play className="h-3.5 w-3.5 fill-white" />
                  Resume Lecture
                </button>
              )}
              <form onSubmit={handleSendDoubt} className="flex gap-2 w-full">
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
          </div>
        </aside>
      </div>

      {/* ═══ IM-ARRANGEABLE TOOLBAR — floats, auto-hides ═══ */}
      <div
        onMouseEnter={() => {
          isHoveringToolbarRef.current = true
          setShowToolbar(true)
          if (hideTimeoutRef.current) {
            clearTimeout(hideTimeoutRef.current)
            hideTimeoutRef.current = null
          }
        }}
        onMouseLeave={() => {
          isHoveringToolbarRef.current = false
          if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current)
          hideTimeoutRef.current = setTimeout(() => {
            if (!isHoveringToolbarRef.current) {
              setShowToolbar(false)
            }
          }, 2000)
        }}
        className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[45] flex items-center gap-3 transition-all duration-300 ease-in-out ${
          showToolbar ? "translate-y-0 opacity-100" : "translate-y-28 opacity-0 pointer-events-none"
        }`}
      >
        <div
          className="flex items-center px-2 rounded-2xl shadow-2xl border border-white/[.08] backdrop-blur-md relative"
          style={{ height: 64, background: "rgba(26, 26, 26, 0.85)" }}
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

          {/* Screen Share */}
          <button id="screenshare-toggle" onClick={() => { setScreenSharing(v => !v); addToast(screenSharing ? "Screen share stopped" : "Screen sharing started") }}
            className={`flex flex-col items-center justify-center gap-0.5 px-3.5 h-full rounded-xl transition-all cursor-pointer ${screenSharing ? "text-purple-400 bg-purple-600/10" : "text-white hover:bg-white/5"}`}>
            <ScreenShare className="h-[18px] w-[18px]" />
            <span className="text-[11px] text-white/35 font-medium">Share</span>
          </button>

          {/* Hand */}
          <button id="hand-raise-toggle" onClick={() => { setHandRaised(v => !v); addToast(handRaised ? "Hand lowered" : "Hand raised") }}
            className={`flex flex-col items-center justify-center gap-0.5 px-3.5 h-full rounded-xl transition-all cursor-pointer ${handRaised ? "text-amber-400 bg-amber-600/10" : "text-white/50 hover:bg-white/5"}`}>
            <Hand className="h-[18px] w-[18px]" />
            <span className="text-[11px] text-white/35 font-medium">Hand</span>
          </button>

          {/* Participants Panel Toggle */}
          <button onClick={() => {
            const next = !isParticipantsOpen
            setIsParticipantsOpen(next)
            if (next) {
              handleParticipantsInteraction()
            }
            localStorage.setItem("participantsOpen", next ? "true" : "false")
          }}
            className={`flex flex-col items-center justify-center gap-0.5 px-3.5 h-full rounded-xl transition-all cursor-pointer ${isParticipantsOpen ? "text-purple-400 bg-purple-600/10" : "text-white/50 hover:bg-white/5"}`}>
            <Users className="h-[18px] w-[18px]" />
            <span className="text-[11px] text-white/35 font-medium">People</span>
          </button>

          {/* More Popover Button */}
          <div className="relative h-full flex items-center">
            <button
              onClick={() => setShowMoreMenu(v => !v)}
              className={`flex flex-col items-center justify-center gap-0.5 px-3.5 h-full rounded-xl transition-all cursor-pointer ${showMoreMenu ? "text-purple-400 bg-purple-600/10" : "text-white/50 hover:bg-white/5"}`}
            >
              <MoreHorizontal className="h-[18px] w-[18px]" />
              <span className="text-[11px] text-white/35 font-medium">More</span>
            </button>

            {/* Premium Popover for Extra Controls */}
            {showMoreMenu && (
              <div
                ref={moreMenuRef}
                className="absolute bottom-20 right-0 bg-[#16161a]/95 border border-white/[.08] rounded-xl p-2 w-48 shadow-2xl flex flex-col gap-1 z-50 backdrop-blur-md"
              >
                {/* Voice speech synthesizer toggle */}
                <button
                  onClick={() => {
                    setSpeechEnabled(v => {
                      const next = !v
                      if (!next) { try { window.speechSynthesis.cancel() } catch { /* ok */ }; setAiSpeechState("idle") }
                      addToast(next ? "Voice on" : "Voice muted")
                      return next
                    })
                  }}
                  className="w-full px-3 py-2 text-left hover:bg-white/5 rounded-lg text-xs font-semibold flex items-center justify-between text-white/80"
                >
                  <span className="flex items-center gap-2">
                    {speechEnabled ? <Volume2 className="h-3.5 w-3.5 text-purple-400" /> : <VolumeX className="h-3.5 w-3.5 text-red-400" />}
                    AI Voice
                  </span>
                  <span className="text-[10px] text-white/30">{speechEnabled ? "On" : "Off"}</span>
                </button>

                {/* Record session */}
                <button
                  onClick={() => { const v = !isRecording; setIsRecording(v); addToast(v ? "Recording session started" : "Recording saved") }}
                  className="w-full px-3 py-2 text-left hover:bg-white/5 rounded-lg text-xs font-semibold flex items-center justify-between text-white/80"
                >
                  <span className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${isRecording ? "bg-red-500 animate-pulse" : "bg-white/35"}`} />
                    Record Class
                  </span>
                  <span className="text-[10px] text-white/30">{isRecording ? "Recording" : "Start"}</span>
                </button>

                {/* Divider if teacher */}
                {isTeacher && teachingMode === "AI" && <div className="h-px bg-white/5 my-1" />}

                {/* Teacher-only: Pause/Resume AI */}
                {isTeacher && teachingMode === "AI" && (
                  <button
                    onClick={() => {
                      if (aiSpeechState === "speaking") {
                        try { window.speechSynthesis.pause() } catch { /* ok */ }
                        setAiSpeechState("paused"); addToast("AI paused")
                      } else {
                        try { window.speechSynthesis.resume() } catch { /* ok */ }
                        setAiSpeechState("speaking"); addToast("AI resumed")
                      }
                      setShowMoreMenu(false)
                    }}
                    className="w-full px-3 py-2 text-left hover:bg-white/5 rounded-lg text-xs font-semibold flex items-center gap-2 text-white/80"
                  >
                    {aiSpeechState === "speaking" ? <Pause className="h-3.5 w-3.5 text-amber-400" /> : <Play className="h-3.5 w-3.5 text-emerald-400" />}
                    {aiSpeechState === "speaking" ? "Pause Lecture" : "Resume Lecture"}
                  </button>
                )}

                {/* Teacher-only: Take Over */}
                {isTeacher && teachingMode === "AI" && (
                  <button
                    onClick={() => { setTeachingMode("Human"); try { window.speechSynthesis.cancel() } catch { /* ok */ }; setAiSpeechState("idle"); addToast("You took over classroom"); setShowMoreMenu(false) }}
                    className="w-full px-3 py-2 text-left hover:bg-white/5 rounded-lg text-xs font-semibold flex items-center gap-2 text-purple-400"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    Take Over Class
                  </button>
                )}
              </div>
            )}
          </div>
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

      {/* ─── OVERLAY ─── */}
      <div 
        className="drawer-overlay"
        style={overlayStyle}
        onClick={() => {
          setIsParticipantsOpen(false)
          localStorage.setItem("participantsOpen", "false")
        }}
      />

      {/* ─── EDGE SWIPE ZONE (MOBILE) ─── */}
      {!isParticipantsOpen && (
        <div 
          className="fixed right-0 top-0 bottom-0 w-6 z-[80] bg-transparent touch-none"
          onTouchStart={handleTouchStart}
        />
      )}

      {/* ─── DRAWER HANDLE ─── */}
      {!isParticipantsOpen && (
        <button
          ref={participantsTabRef}
          type="button"
          onMouseEnter={() => {
            setIsParticipantsOpen(true)
            handleParticipantsInteraction()
            localStorage.setItem("participantsOpen", "true")
          }}
          onClick={() => {
            setIsParticipantsOpen(true)
            handleParticipantsInteraction()
            localStorage.setItem("participantsOpen", "true")
          }}
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
          className="drawer-handle shadow-lg border-none outline-none focus:outline-none"
        >
          <div className="flex flex-col items-center gap-2">
            <span className="text-[10px] text-purple-400 font-bold animate-pulse">◀</span>
            <Users className="h-3.5 w-3.5 text-white/70" />
            <span 
              style={{ writingMode: "vertical-rl" }} 
              className="text-[9px] font-black uppercase tracking-[0.2em] text-white/50 select-none my-1"
            >
              People
            </span>
          </div>
        </button>
      )}

      {/* ─── INSTAGRAM HINT ─── */}
      {!isParticipantsOpen && showHint && (
        <div className="hint-indicator">
          {/* page indicator dot */}
          <div className="h-1.5 w-1.5 rounded-full bg-purple-500 shadow-lg shadow-purple-500/50 animate-pulse" />
          <div className="h-1 w-1 rounded-full bg-white/20" />
          {/* animated arrow */}
          <div className="hint-arrow mt-2 bg-purple-600/90 text-white rounded-full p-1 border border-purple-400/20 shadow-md">
            <span className="text-[9px] font-black leading-none block">←</span>
          </div>
        </div>
      )}

      {/* ─── DRAWER CONTAINER ─── */}
      <div
        ref={drawerRef}
        className="drawer-container flex flex-col"
        style={{
          transform: transformStr,
          transition: isDragging ? "none" : "transform 300ms cubic-bezier(0.16, 1, 0.3, 1)",
        }}
        onTouchStart={(e) => {
          // Allow swipe dismissal from within the drawer container if started on the edge
          const touchX = e.touches[0].clientX
          const rect = drawerRef.current?.getBoundingClientRect()
          if (rect && touchX < rect.left + 30) {
            setIsDragging(true)
            setStartX(touchX)
            setCurrentX(touchX)
            setDragOffset(0)
          }
        }}
      >
        {/* Drawer Header */}
        <div className="h-14 border-b border-white/[.06] px-5 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <Users className="h-4 w-4 text-purple-400" />
            <h3 className="font-bold text-sm text-white">Participants</h3>
            <span className="px-2 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-[10px] font-bold text-purple-400">
              {students.length}
            </span>
          </div>
          <button
            onClick={() => {
              setIsParticipantsOpen(false)
              localStorage.setItem("participantsOpen", "false")
            }}
            className="h-8 w-8 rounded-lg bg-white/[.02] border border-white/5 flex items-center justify-center text-white/50 hover:text-white hover:bg-white/5 transition-all cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Drawer Controls (Search & Filters) */}
        <div className="p-4 border-b border-white/[.06] space-y-3 flex-shrink-0">
          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-white/30" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search people..."
              className="w-full pl-9 pr-4 py-2 bg-[#16161A] border border-white/[.06] rounded-xl text-xs focus:outline-none focus:border-purple-500/40 text-white placeholder:text-white/35 transition-all"
            />
          </div>

          {/* Filters */}
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-white/40 font-bold uppercase tracking-wider">Filters</span>
            <button
              onClick={() => setShowOnlyActive(prev => !prev)}
              className={`px-2.5 py-1 rounded-lg border text-[10px] font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                showOnlyActive
                  ? "bg-purple-600/10 border-purple-500/30 text-purple-400"
                  : "bg-white/[.02] border-white/10 text-white/60 hover:text-white hover:bg-white/5"
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${showOnlyActive ? "bg-purple-400 animate-pulse" : "bg-white/30"}`} />
              Active Speakers
            </button>
          </div>
        </div>

        {/* Participant List */}
        <div className="flex-1 overflow-y-auto cscroll p-3 space-y-1">
          {filteredStudents.length > 0 ? (
            filteredStudents.map((s) => {
              const isSpeaking = speakingStudentIds.has(s.id);
              const { isMuted, hasHandRaised, connectionQual } = getStudentProps(s);
              
              // connection icon
              let connColor = "text-emerald-500";
              if (connectionQual === "Good") connColor = "text-amber-500";
              if (connectionQual === "Fair") connColor = "text-rose-500";

              return (
                <div
                  key={s.id}
                  className={`flex items-center justify-between p-2.5 rounded-xl transition-all border border-transparent ${
                    isSpeaking 
                      ? "bg-purple-950/15 border-purple-500/20" 
                      : "hover:bg-white/[.02]"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Avatar with speaking animation */}
                    <div className="relative">
                      {isSpeaking && (
                        <div className="absolute -inset-1 rounded-full border border-purple-500/80 animate-ping opacity-70" />
                      )}
                      <div
                        className={`h-9 w-9 rounded-full bg-gradient-to-br from-[#1e1e2e] to-[#2d2d44] border flex items-center justify-center text-xs font-bold shadow-md relative z-10 transition-all ${
                          isSpeaking ? "border-purple-400 ring-2 ring-purple-600/30" : "border-white/10"
                        }`}
                      >
                        {s.name?.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase() || "?"}
                      </div>
                      {/* focus dot status */}
                      <span className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border border-[#0E0E10] z-20 ${
                        s.status === "active" || s.status === "focused" ? "bg-emerald-500" : 
                        s.status === "idle" || s.status === "distracted" ? "bg-amber-500" : 
                        s.status === "away" ? "bg-rose-500" : 
                        s.status === "sleeping" ? "bg-cyan-500 animate-pulse" : 
                        s.status === "phone" ? "bg-red-500 animate-ping" : 
                        "bg-gray-500"
                      }`} />
                    </div>

                    {/* Name & status */}
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-bold text-white truncate flex items-center gap-1.5">
                        {s.name}
                        {s.id === studentId && (
                          <span className="text-[8px] bg-purple-500/25 px-1 py-0.2 rounded font-black text-purple-300">YOU</span>
                        )}
                        {s.status === "sleeping" && (
                          <span className="text-[8px] bg-cyan-950 border border-cyan-800 text-cyan-400 px-1 py-0.2 rounded font-bold animate-pulse">😴 SLEEPING</span>
                        )}
                        {s.status === "phone" && (
                          <span className="text-[8px] bg-red-950 border border-red-800 text-red-400 px-1 py-0.2 rounded font-bold animate-pulse">📱 USING PHONE</span>
                        )}
                      </span>
                      <span className="text-[10px] text-white/30 truncate uppercase tracking-wider font-semibold">
                        {s.status === "phone" ? "USING PHONE" : s.status === "sleeping" ? "SLEEPING" : s.status} • {s.engagementScore}%
                      </span>
                    </div>
                  </div>

                  {/* Actions & Status Indicators */}
                  <div className="flex items-center gap-2">
                    {/* hand raise */}
                    {hasHandRaised && (
                      <div className="bg-amber-500/15 border border-amber-500/30 rounded-lg p-1.5 text-amber-400 animate-bounce">
                        <Hand className="h-3 w-3" />
                      </div>
                    )}

                    {/* mic status */}
                    <div className={`p-1.5 rounded-lg border ${
                      isMuted 
                        ? "bg-red-500/10 border-red-500/20 text-red-400" 
                        : "bg-white/[.02] border-white/5 text-white/40"
                    }`}>
                      {isMuted ? <MicOff className="h-3 w-3" /> : <Mic className="h-3 w-3" />}
                    </div>

                    {/* connection quality */}
                    <div className={`p-1.5 rounded-lg bg-white/[.02] border border-white/5 ${connColor}`} title={`Connection: ${connectionQual}`}>
                      <svg className="h-3 w-3 fill-current" viewBox="0 0 24 24">
                        <rect x="3" y="16" width="3" height="5" rx="0.5" opacity={connectionQual === "Fair" ? 0.3 : 1} />
                        <rect x="9" y="11" width="3" height="10" rx="0.5" opacity={connectionQual === "Fair" || connectionQual === "Good" ? 0.3 : 1} />
                        <rect x="15" y="6" width="3" height="15" rx="0.5" />
                      </svg>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-center py-10 space-y-2">
              <Users className="h-8 w-8 text-white/10 mx-auto" />
              <p className="text-xs text-white/30">No participants found</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
