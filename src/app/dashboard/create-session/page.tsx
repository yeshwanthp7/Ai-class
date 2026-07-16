"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import {
  ArrowLeft,
  ArrowRight,
  Plus,
  Trash2,
  GripVertical,
  Copy,
  Check,
  Share2,
  Calendar,
  Clock,
  Menu,
  Sparkles,
  User as UserIcon,
  Upload,
  FileText,
  CheckSquare,
  Square,
} from "lucide-react"
import DashboardSidebar from "@/components/dashboard-sidebar"
import { subscribeToAuthChanges } from "@/lib/auth-service"
import { createSession } from "@/lib/session-service"
import { saveFile, clearFiles } from "@/lib/fileStorage"

const SUBJECTS = ["Mathematics", "Science", "History", "Computer Science", "Language", "Other"]
const GRADE_LEVELS = ["Primary", "Middle School", "High School", "University", "Professional"]
const SUGGESTED_TOPICS = ["Introduction", "Core Concepts", "Examples", "Practice Problems", "Summary"]

export default function CreateSessionPage() {
  const [user, setUser] = useState<any>(null)
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false)
  const [step, setStep] = useState(1) // 1: Mode, 2: Info, 3: Content, 4: Launch
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [teachingMode, setTeachingMode] = useState<"AI" | "Human" | null>("AI")

  // Step 2 State: Session Info
  const [sessionTitle, setSessionTitle] = useState("")
  const [subject, setSubject] = useState("Mathematics")
  const [gradeLevel, setGradeLevel] = useState("High School")
  const [duration, setDuration] = useState("60 min")
  const [customDuration, setCustomDuration] = useState("")
  const [sessionType, setSessionType] = useState<"Public" | "Private">("Public")

  // Step 3 State: Content Configuration (AI Mode)
  const [aiTab, setAiTab] = useState<"upload" | "topics">("upload")
  const [uploadedFile, setUploadedFile] = useState<{ name: string; size: string; pages: number } | null>(null)
  const [aiInstructions, setAiInstructions] = useState("")

  // Step 3 State: Content Configuration (Human Mode)
  const [referenceMaterial, setReferenceMaterial] = useState<{ name: string; size: string } | null>(null)
  const [aiAssistants, setAiAssistants] = useState({
    generateVisuals: true,
    doubtChat: true,
    suggestVideos: true,
    sessionNotes: true,
    postSummary: true,
  })

  // Shared Step 3 State: Topics List
  const [topics, setTopics] = useState<string[]>([""])
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)

  // Step 4 State: Launch Info
  const [sessionCode, setSessionCode] = useState("")
  const [isCopied, setIsCopied] = useState(false)
  const [scheduleLater, setScheduleLater] = useState(false)
  const [scheduledDate, setScheduledDate] = useState("")

  // Load current auth state
  useEffect(() => {
    const unsubscribe = subscribeToAuthChanges((currentUser) => {
      setUser(currentUser)
    })
    return () => unsubscribe()
  }, [])

  // Generate a random session code when navigating to step 4
  const generateCode = () => {
    const chars = "ABCDEFGHJKLMNOPQRSTUVWXYZ23456789" // Exclude confusing chars like I, O, 1, 0
    let code = "CLASS-"
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return code
  }

  // Handle real file upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: "ai" | "human") => {
    const file = e.target.files?.[0]
    if (!file) return

    // Save to IndexedDB
    try {
      await saveFile("session-pdf", file)
    } catch (err) {
      console.error("Failed to save file to IndexedDB:", err)
      alert("Failed to read file. Please try again.")
      return
    }

    const sizeStr = (file.size / 1024 / 1024).toFixed(1) + " MB"
    if (type === "ai") {
      setUploadedFile({
        name: file.name,
        size: sizeStr,
        pages: 0, // We'll parse pages in the live classroom
      })
    } else {
      setReferenceMaterial({
        name: file.name,
        size: sizeStr,
      })
    }
  }

  const handleStep1Submit = () => {
    if (!teachingMode) return
    setStep(2)
  }

  const handleStep2Submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!sessionTitle.trim()) return
    setStep(3)
  }

  const handleStep3Submit = (e: React.FormEvent) => {
    e.preventDefault()
    
    // Clean up empty topics if we are using the topic list
    if (teachingMode === "Human" || (teachingMode === "AI" && aiTab === "topics")) {
      const cleanedTopics = topics.filter(t => t.trim() !== "")
      setTopics(cleanedTopics)
    }

    // Generate session code
    setSessionCode(generateCode())
    setStep(4)
  }

  const handleLaunch = async () => {
    if (!user) {
      alert("You must be logged in to create a session.")
      return
    }
    setIsSubmitting(true)
    try {
      const activeDuration = duration === "Custom" ? `${customDuration} min` : duration
      
      const extraSettings: any = {}
      if (teachingMode) extraSettings.teachingMode = teachingMode
      if (teachingMode === "AI" && aiInstructions) extraSettings.aiInstructions = aiInstructions
      if (teachingMode === "Human") extraSettings.aiAssistants = aiAssistants
      if (teachingMode === "AI" && aiTab === "upload" && uploadedFile) {
        extraSettings.uploadedFile = uploadedFile
      } else {
        try { await clearFiles() } catch { /* ignore */ }
      }
      if (teachingMode === "Human" && referenceMaterial) extraSettings.referenceMaterial = referenceMaterial

      const createPromise = createSession(
        user.uid,
        sessionTitle,
        subject,
        gradeLevel,
        activeDuration,
        sessionType,
        (teachingMode === "Human" || aiTab === "topics") ? topics.filter((t) => t.trim() !== "") : [],
        sessionCode,
        scheduleLater ? scheduledDate : undefined,
        extraSettings
      )

      await Promise.race([
        createPromise,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Database connection timed out. Please check your internet connection, ensure that the Firebase credentials in .env.local are correct, and that your Firestore Database is enabled in the Firebase console.")), 8000)
        )
      ])
      
      window.location.href = `/session/${sessionCode}`
    } catch (err: any) {
      console.warn("Session creation failed:", err)
      alert("Failed to create session: " + err.message)
      setIsSubmitting(false)
    }
  }

  // Topic list helper functions
  const addTopicField = () => {
    if (topics.length >= 10) return
    setTopics([...topics, ""])
  }

  const handleTopicChange = (index: number, val: string) => {
    const newTopics = [...topics]
    newTopics[index] = val
    setTopics(newTopics)
  }

  const removeTopicField = (index: number) => {
    if (topics.length <= 1) return
    const newTopics = topics.filter((_, i) => i !== index)
    setTopics(newTopics)
  }

  const handleSuggestionClick = (suggestion: string) => {
    const lastIdx = topics.length - 1
    if (topics[lastIdx]?.trim() === "") {
      const newTopics = [...topics]
      newTopics[lastIdx] = suggestion
      setTopics(newTopics)
    } else if (topics.length < 10) {
      setTopics([...topics, suggestion])
    }
  }

  // HTML5 Drag and Drop Reordering Handlers
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index)
    e.dataTransfer.effectAllowed = "move"
  }

  const handleDragEnter = (e: React.DragEvent, targetIndex: number) => {
    if (draggedIndex === null || draggedIndex === targetIndex) return
    const newTopics = [...topics]
    const draggedItem = newTopics[draggedIndex]
    
    newTopics.splice(draggedIndex, 1)
    newTopics.splice(targetIndex, 0, draggedItem)
    
    setDraggedIndex(targetIndex)
    setTopics(newTopics)
  }

  const handleDragEnd = () => {
    setDraggedIndex(null)
  }

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(sessionCode)
      setIsCopied(true)
      setTimeout(() => setIsCopied(false), 2000)
    } catch (err) {
      console.error("Failed to copy code", err)
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
      alert("Join link copied to clipboard!")
    } catch (err) {
      console.error("Failed to copy link", err)
    }
  }

  const toggleAssistantCheckbox = (key: keyof typeof aiAssistants) => {
    setAiAssistants({
      ...aiAssistants,
      [key]: !aiAssistants[key],
    })
  }

  return (
    <div className="min-h-screen bg-[#111111] text-white flex font-sans antialiased">
      <DashboardSidebar
        activeItem="Dashboard"
        isMobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 lg:ml-64 flex flex-col min-h-screen">
        
        {/* Header Topbar */}
        <header className="h-16 border-b border-[#1a1a1a] bg-[#111111]/80 backdrop-blur-xl px-6 md:px-8 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsMobileSidebarOpen(true)}
              className="p-1.5 rounded-lg border border-white/10 hover:bg-white/5 lg:hidden text-white/80 hover:text-white"
            >
              <Menu className="h-5 w-5" />
            </button>
            
            <div className="flex items-center gap-3">
              <Link href="/dashboard" className="p-1 rounded-lg hover:bg-[#1a1a1a] text-white/60 hover:text-white transition-colors">
                <ArrowLeft className="h-4.5 w-4.5" />
              </Link>
              <h1 className="text-base md:text-lg font-bold text-white tracking-tight">
                Create New Session
              </h1>
            </div>
          </div>
        </header>

        {/* Form Container */}
        <main className="flex-1 p-6 md:p-8 flex justify-center items-start lg:items-center bg-[#111111]">
          <div className="w-full max-w-[700px] bg-[#1a1a1a] border border-white/5 rounded-2xl p-6 md:p-8 space-y-8 shadow-xl shadow-black/10">
            
            {/* Header & Subtitle */}
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold text-white tracking-tight">Create New Session</h2>
              <p className="text-xs md:text-sm text-white/40">Set up your AI-powered class in seconds</p>
            </div>

            {/* Step Indicator (Mode -> Info -> Content -> Launch) */}
            <div className="relative flex items-center justify-between max-w-md mx-auto py-2">
              {/* Connector Lines */}
              <div className="absolute left-0 right-0 top-1/2 h-0.5 bg-white/5 -translate-y-1/2 z-0" />
              <div
                className="absolute left-0 top-1/2 h-0.5 bg-purple-500 -translate-y-1/2 transition-all duration-300 z-0"
                style={{ width: step === 1 ? "0%" : step === 2 ? "33%" : step === 3 ? "66%" : "100%" }}
              />

              {/* Step 1: Mode */}
              <div className="relative z-10 flex flex-col items-center gap-1.5">
                <div
                  className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold transition-all border ${
                    step >= 1
                      ? "bg-purple-600 border-purple-500 text-white shadow-sm shadow-purple-500/30"
                      : "bg-[#111111] border-white/10 text-white/40"
                  }`}
                >
                  1
                </div>
                <span className={`text-[10px] md:text-xs font-semibold ${step >= 1 ? "text-purple-400" : "text-white/40"}`}>
                  Mode
                </span>
              </div>

              {/* Step 2: Info */}
              <div className="relative z-10 flex flex-col items-center gap-1.5">
                <div
                  className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold transition-all border ${
                    step >= 2
                      ? "bg-purple-600 border-purple-500 text-white shadow-sm shadow-purple-500/30"
                      : "bg-[#111111] border-white/10 text-white/40"
                  }`}
                >
                  2
                </div>
                <span className={`text-[10px] md:text-xs font-semibold ${step >= 2 ? "text-purple-400" : "text-white/40"}`}>
                  Session Info
                </span>
              </div>

              {/* Step 3: Content */}
              <div className="relative z-10 flex flex-col items-center gap-1.5">
                <div
                  className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold transition-all border ${
                    step >= 3
                      ? "bg-purple-600 border-purple-500 text-white shadow-sm shadow-purple-500/30"
                      : "bg-[#111111] border-white/10 text-white/40"
                  }`}
                >
                  3
                </div>
                <span className={`text-[10px] md:text-xs font-semibold ${step >= 3 ? "text-purple-400" : "text-white/40"}`}>
                  Content
                </span>
              </div>

              {/* Step 4: Launch */}
              <div className="relative z-10 flex flex-col items-center gap-1.5">
                <div
                  className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold transition-all border ${
                    step >= 4
                      ? "bg-purple-600 border-purple-500 text-white shadow-sm shadow-purple-500/30"
                      : "bg-[#111111] border-white/10 text-white/40"
                  }`}
                >
                  4
                </div>
                <span className={`text-[10px] md:text-xs font-semibold ${step >= 4 ? "text-purple-400" : "text-white/40"}`}>
                  Launch
                </span>
              </div>
            </div>

            {/* STEP 1: TEACHING MODE SELECTOR */}
            {step === 1 && (
              <div className="space-y-6 animate-fadeIn">
                <div className="text-center space-y-1">
                  <label className="text-xs font-bold uppercase tracking-wider text-white/60">
                    Select Teaching Mode
                  </label>
                  <p className="text-[10px] text-white/30">Choose how the lecture will be delivered</p>
                </div>

                <div className="max-w-md mx-auto">
                  {/* Card 1: AI Teacher */}
                  <div
                    onClick={() => setTeachingMode("AI")}
                    className={`group relative overflow-hidden rounded-2xl bg-[#111111] border p-6 transition-all flex flex-col gap-4 border-purple-500 shadow-[0_0_20px_rgba(147,51,234,0.3)] bg-purple-500/[0.02]`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-400">
                        <Sparkles className="h-5 w-5 animate-pulse" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-white">AI Teacher</h3>
                        <p className="text-[10px] text-white/40">Automated AI lecturing</p>
                      </div>
                    </div>

                    <ul className="space-y-2.5 text-xs text-white/70 mt-2">
                      <li className="flex items-center gap-2">
                        <span className="text-purple-400 font-bold">✓</span> AI speaks & teaches automatically
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="text-purple-400 font-bold">✓</span> Upload PPT/PDF or add topics
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="text-purple-400 font-bold">✓</span> Generates visuals & plays videos
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="text-purple-400 font-bold">✓</span> Answers student doubts instantly
                      </li>
                    </ul>
                  </div>
                </div>

                {teachingMode && (
                  <button
                    onClick={handleStep1Submit}
                    className="w-full flex items-center justify-center gap-1.5 py-3.5 rounded-xl bg-purple-600 hover:bg-purple-500 font-bold text-sm text-white shadow-md shadow-purple-600/20 hover:shadow-purple-600/30 transition-all cursor-pointer animate-slideUp"
                  >
                    Continue
                    <ArrowRight className="h-4 w-4" />
                  </button>
                )}
              </div>
            )}

            {/* STEP 2: SESSION INFO */}
            {step === 2 && (
              <form onSubmit={handleStep2Submit} className="space-y-6 animate-fadeIn">
                {/* Title */}
                <div className="space-y-2">
                  <label htmlFor="session-title" className="text-xs font-bold uppercase tracking-wider text-white/60">
                    Session Title
                  </label>
                  <input
                    id="session-title"
                    type="text"
                    required
                    value={sessionTitle}
                    onChange={(e) => setSessionTitle(e.target.value)}
                    placeholder="e.g. Introduction to Physics"
                    className="w-full px-4 py-3 bg-[#111111] border border-white/10 rounded-xl text-sm focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all text-white placeholder-white/20"
                  />
                </div>

                {/* Grid for Dropdowns */}
                <div className="grid gap-6 md:grid-cols-2">
                  {/* Subject */}
                  <div className="space-y-2">
                    <label htmlFor="subject-select" className="text-xs font-bold uppercase tracking-wider text-white/60">
                      Subject
                    </label>
                    <div className="relative">
                      <select
                        id="subject-select"
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        className="w-full px-4 py-3 bg-[#111111] border border-white/10 rounded-xl text-sm focus:outline-none focus:border-purple-500 transition-all text-white appearance-none cursor-pointer"
                      >
                        {SUBJECTS.map((sub) => (
                          <option key={sub} value={sub} className="bg-[#1a1a1a]">
                            {sub}
                          </option>
                        ))}
                      </select>
                      <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-white/40">
                        ▼
                      </div>
                    </div>
                  </div>

                  {/* Grade Level */}
                  <div className="space-y-2">
                    <label htmlFor="grade-select" className="text-xs font-bold uppercase tracking-wider text-white/60">
                      Grade Level
                    </label>
                    <div className="relative">
                      <select
                        id="grade-select"
                        value={gradeLevel}
                        onChange={(e) => setGradeLevel(e.target.value)}
                        className="w-full px-4 py-3 bg-[#111111] border border-white/10 rounded-xl text-sm focus:outline-none focus:border-purple-500 transition-all text-white appearance-none cursor-pointer"
                      >
                        {GRADE_LEVELS.map((grade) => (
                          <option key={grade} value={grade} className="bg-[#1a1a1a]">
                            {grade}
                          </option>
                        ))}
                      </select>
                      <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-white/40">
                        ▼
                      </div>
                    </div>
                  </div>
                </div>

                {/* Duration */}
                <div className="space-y-3">
                  <label className="text-xs font-bold uppercase tracking-wider text-white/60 block">
                    Estimated Duration
                  </label>
                  <div className="flex flex-wrap gap-2.5">
                    {["30 min", "60 min", "90 min", "Custom"].map((dur) => (
                      <button
                        key={dur}
                        type="button"
                        onClick={() => setDuration(dur)}
                        className={`px-4 py-2 text-xs font-semibold rounded-xl border transition-all cursor-pointer ${
                          duration === dur
                            ? "bg-purple-600 border-purple-500 text-white shadow-sm shadow-purple-500/10"
                            : "bg-[#111111] border-white/5 text-white/60 hover:border-white/10"
                        }`}
                      >
                        {dur}
                      </button>
                    ))}
                  </div>

                  {duration === "Custom" && (
                    <div className="flex items-center gap-2.5 mt-2 animate-slideDown">
                      <input
                        type="number"
                        min="1"
                        max="300"
                        required
                        value={customDuration}
                        onChange={(e) => setCustomDuration(e.target.value)}
                        placeholder="Enter duration"
                        className="w-32 px-4 py-2.5 bg-[#111111] border border-white/10 rounded-xl text-sm focus:outline-none focus:border-purple-500 text-white"
                      />
                      <span className="text-xs text-white/50 font-medium">minutes</span>
                    </div>
                  )}
                </div>

                {/* Session Type */}
                <div className="space-y-3">
                  <label className="text-xs font-bold uppercase tracking-wider text-white/60 block">
                    Session Type
                  </label>
                  <div className="grid grid-cols-2 gap-4">
                    <div
                      onClick={() => setSessionType("Public")}
                      className={`p-4 rounded-xl border cursor-pointer transition-all flex flex-col gap-1.5 ${
                        sessionType === "Public"
                          ? "bg-purple-600/5 border-purple-500"
                          : "bg-[#111111] border-white/5 opacity-60 hover:opacity-100"
                      }`}
                    >
                      <span className="text-xs font-bold text-white">Public</span>
                      <span className="text-[10px] text-white/40 leading-tight">
                        Anyone with the room code can join and participate
                      </span>
                    </div>

                    <div
                      onClick={() => setSessionType("Private")}
                      className={`p-4 rounded-xl border cursor-pointer transition-all flex flex-col gap-1.5 ${
                        sessionType === "Private"
                          ? "bg-purple-600/5 border-purple-500"
                          : "bg-[#111111] border-white/5 opacity-60 hover:opacity-100"
                      }`}
                    >
                      <span className="text-xs font-bold text-white">Private</span>
                      <span className="text-[10px] text-white/40 leading-tight">
                        Only invited students or verified emails can enter
                      </span>
                    </div>
                  </div>
                </div>

                {/* CTA Buttons */}
                <div className="space-y-4 pt-4">
                  <button
                    type="submit"
                    className="w-full flex items-center justify-center gap-1.5 py-3.5 rounded-xl bg-purple-600 hover:bg-purple-500 font-bold text-sm text-white shadow-md shadow-purple-600/20 hover:shadow-purple-600/30 transition-all cursor-pointer"
                  >
                    Continue
                    <ArrowRight className="h-4 w-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="w-full text-center text-xs font-semibold text-white/40 hover:text-white/60 transition-colors cursor-pointer"
                  >
                    Back to Teaching Mode
                  </button>
                </div>
              </form>
            )}

            {/* STEP 3: CONTENT / TOPICS CONFIGURATION */}
            {step === 3 && (
              <form onSubmit={handleStep3Submit} className="space-y-6 animate-fadeIn">
                
                {/* ─── BRANCH: AI TEACHER ─── */}
                {teachingMode === "AI" && (
                  <div className="space-y-6">
                    {/* Sub-Tabs */}
                    <div className="grid grid-cols-2 gap-1 rounded-xl bg-[#111111] border border-white/5 p-1">
                      <button
                        type="button"
                        onClick={() => setAiTab("upload")}
                        className={`rounded-lg py-2 text-xs font-bold transition-all cursor-pointer ${
                          aiTab === "upload"
                            ? "bg-purple-600 text-white shadow-sm"
                            : "text-white/60 hover:text-white"
                        }`}
                      >
                        Upload PPT/PDF
                      </button>
                      <button
                        type="button"
                        onClick={() => setAiTab("topics")}
                        className={`rounded-lg py-2 text-xs font-bold transition-all cursor-pointer ${
                          aiTab === "topics"
                            ? "bg-purple-600 text-white shadow-sm"
                            : "text-white/60 hover:text-white"
                        }`}
                      >
                        Add Topics
                      </button>
                    </div>

                    {/* AI Tab 1: Upload */}
                    {aiTab === "upload" && (
                      <div className="space-y-4">
                        <label className="text-xs font-bold uppercase tracking-wider text-white/60 block">
                          Upload Class Presentations or Documents
                        </label>
                        
                        {!uploadedFile ? (
                          <label className="border-2 border-dashed border-white/10 hover:border-purple-500/50 bg-[#111111]/50 rounded-xl p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-3 group relative">
                            <input
                              type="file"
                              accept=".pdf,.ppt,.pptx"
                              className="hidden"
                              onChange={(e) => handleFileUpload(e, "ai")}
                            />
                            <div className="h-10 w-10 rounded-full bg-white/5 flex items-center justify-center text-white/40 group-hover:text-purple-400 group-hover:bg-purple-500/10 transition-all">
                              <Upload className="h-5 w-5" />
                            </div>
                            <div>
                              <p className="text-xs font-bold text-white">Click to upload lecture slides or syllabus</p>
                              <p className="text-[10px] text-white/30 mt-1">Accepts .ppt, .pptx, .pdf (Max 50MB)</p>
                            </div>
                          </label>
                        ) : (
                          <div className="flex items-center justify-between bg-purple-500/5 border border-purple-500/20 p-4 rounded-xl animate-fadeIn">
                            <div className="flex items-center gap-3 overflow-hidden">
                              <div className="h-9 w-9 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-400 flex-shrink-0">
                                <FileText className="h-4.5 w-4.5" />
                              </div>
                              <div className="overflow-hidden">
                                <p className="text-xs font-semibold text-white truncate">{uploadedFile.name}</p>
                                <p className="text-[9px] text-white/40 font-medium">{uploadedFile.size} • {uploadedFile.pages} pages</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="h-6 w-6 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center text-xs">
                                ✓
                              </span>
                              <button
                                type="button"
                                onClick={() => setUploadedFile(null)}
                                className="text-white/20 hover:text-red-400 p-1.5 transition-colors"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Optional AI Instructions */}
                        <div className="space-y-2 pt-2">
                          <label className="text-xs font-bold uppercase tracking-wider text-white/60">
                            Optional Instructions for AI
                          </label>
                          <textarea
                            value={aiInstructions}
                            onChange={(e) => setAiInstructions(e.target.value)}
                            placeholder="e.g. Focus on interactive quiz check-ins, explain in simple terms, include real-world applications..."
                            rows={3}
                            className="w-full px-4 py-3 bg-[#111111] border border-white/10 rounded-xl text-sm focus:outline-none focus:border-purple-500 transition-all text-white placeholder-white/20 resize-none"
                          />
                        </div>
                      </div>
                    )}

                    {/* AI Tab 2: Topics List */}
                    {aiTab === "topics" && renderTopicsList()}
                  </div>
                )}

                {/* ─── BRANCH: HUMAN TEACHER ─── */}
                {teachingMode === "Human" && (
                  <div className="space-y-6">
                    {/* Standard Topics List */}
                    <div>
                      <label className="text-xs font-bold uppercase tracking-wider text-white/60 block mb-3">
                        Plan lecture outline / topics
                      </label>
                      {renderTopicsList()}
                    </div>

                    {/* Reference Material (Smaller Box) */}
                    <div className="space-y-3 pt-2">
                      <label className="text-xs font-bold uppercase tracking-wider text-white/60 block">
                        Reference Material (Optional)
                      </label>
                      {!referenceMaterial ? (
                        <label className="border border-dashed border-white/10 hover:border-purple-500/50 bg-[#111111]/30 rounded-xl p-4 text-center cursor-pointer transition-all flex items-center justify-center gap-2 group relative">
                          <input
                            type="file"
                            accept=".pdf,.ppt,.pptx"
                            className="hidden"
                            onChange={(e) => handleFileUpload(e, "human")}
                          />
                          <Upload className="h-4 w-4 text-white/30 group-hover:text-purple-400" />
                          <span className="text-xs text-white/40 group-hover:text-white/60 font-semibold">
                            Upload slides/documents for the AI assistant
                          </span>
                        </label>
                      ) : (
                        <div className="flex items-center justify-between bg-white/[0.02] border border-white/5 p-3 rounded-xl animate-fadeIn">
                          <div className="flex items-center gap-2.5 overflow-hidden">
                            <FileText className="h-4 w-4 text-purple-400 flex-shrink-0" />
                            <span className="text-xs font-semibold text-white/80 truncate">{referenceMaterial.name}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setReferenceMaterial(null)}
                            className="text-white/20 hover:text-red-400 transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* AI Assistant Checkboxes */}
                    <div className="space-y-3 pt-2 border-t border-white/5">
                      <label className="text-xs font-bold uppercase tracking-wider text-white/60 block">
                        AI Assistant Features
                      </label>
                      
                      <div className="grid gap-3 sm:grid-cols-2">
                        {/* Checkbox 1 */}
                        <div
                          onClick={() => toggleAssistantCheckbox("generateVisuals")}
                          className="flex items-center gap-3 p-3 bg-[#111111] border border-white/5 rounded-xl cursor-pointer hover:border-purple-500/30 transition-all"
                        >
                          {aiAssistants.generateVisuals ? (
                            <CheckSquare className="h-4.5 w-4.5 text-purple-400" />
                          ) : (
                            <Square className="h-4.5 w-4.5 text-white/20" />
                          )}
                          <span className="text-xs font-semibold text-white/80">Generate visuals while I teach</span>
                        </div>

                        {/* Checkbox 2 */}
                        <div
                          onClick={() => toggleAssistantCheckbox("doubtChat")}
                          className="flex items-center gap-3 p-3 bg-[#111111] border border-white/5 rounded-xl cursor-pointer hover:border-purple-500/30 transition-all"
                        >
                          {aiAssistants.doubtChat ? (
                            <CheckSquare className="h-4.5 w-4.5 text-purple-400" />
                          ) : (
                            <Square className="h-4.5 w-4.5 text-white/20" />
                          )}
                          <span className="text-xs font-semibold text-white/80">Handle student doubt chat</span>
                        </div>

                        {/* Checkbox 3 */}
                        <div
                          onClick={() => toggleAssistantCheckbox("suggestVideos")}
                          className="flex items-center gap-3 p-3 bg-[#111111] border border-white/5 rounded-xl cursor-pointer hover:border-purple-500/30 transition-all"
                        >
                          {aiAssistants.suggestVideos ? (
                            <CheckSquare className="h-4.5 w-4.5 text-purple-400" />
                          ) : (
                            <Square className="h-4.5 w-4.5 text-white/20" />
                          )}
                          <span className="text-xs font-semibold text-white/80">Suggest YouTube videos</span>
                        </div>

                        {/* Checkbox 4 */}
                        <div
                          onClick={() => toggleAssistantCheckbox("sessionNotes")}
                          className="flex items-center gap-3 p-3 bg-[#111111] border border-white/5 rounded-xl cursor-pointer hover:border-purple-500/30 transition-all"
                        >
                          {aiAssistants.sessionNotes ? (
                            <CheckSquare className="h-4.5 w-4.5 text-purple-400" />
                          ) : (
                            <Square className="h-4.5 w-4.5 text-white/20" />
                          )}
                          <span className="text-xs font-semibold text-white/80">Take live session notes</span>
                        </div>

                        {/* Checkbox 5 */}
                        <div
                          onClick={() => toggleAssistantCheckbox("postSummary")}
                          className="flex items-center gap-3 p-3 bg-[#111111] border border-white/5 rounded-xl cursor-pointer hover:border-purple-500/30 transition-all"
                        >
                          {aiAssistants.postSummary ? (
                            <CheckSquare className="h-4.5 w-4.5 text-purple-400" />
                          ) : (
                            <Square className="h-4.5 w-4.5 text-white/20" />
                          )}
                          <span className="text-xs font-semibold text-white/80">Post-session summary</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* CTA Buttons */}
                <div className="space-y-4 pt-4 border-t border-white/5">
                  <button
                    type="submit"
                    className="w-full flex items-center justify-center gap-1.5 py-3.5 rounded-xl bg-purple-600 hover:bg-purple-500 font-bold text-sm text-white shadow-md shadow-purple-600/20 hover:shadow-purple-600/30 transition-all cursor-pointer"
                  >
                    Continue
                    <ArrowRight className="h-4 w-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="w-full text-center text-xs font-semibold text-white/40 hover:text-white/60 transition-colors cursor-pointer"
                  >
                    Back to Session Info
                  </button>
                </div>

              </form>
            )}

            {/* STEP 4: LAUNCH */}
            {step === 4 && (
              <div className="space-y-6 animate-fadeIn">
                
                {/* Summary Card */}
                <div className="bg-[#111111] border border-white/5 rounded-xl p-5 space-y-4">
                  <div>
                    <h3 className="text-base font-bold text-white leading-tight">{sessionTitle}</h3>
                    <p className="text-[10px] text-white/40 mt-1 font-semibold uppercase tracking-wider">
                      {subject} • {gradeLevel} • {duration === "Custom" ? `${customDuration} min` : duration} • {sessionType}
                    </p>
                    <p className="text-[10px] text-purple-400 font-bold uppercase tracking-wider mt-1.5">
                      Teaching Mode: {teachingMode === "AI" ? "AI Teacher" : "I'll Teach (Led by human)"}
                    </p>
                  </div>

                  {teachingMode === "AI" && aiTab === "upload" && uploadedFile && (
                    <div className="border-t border-white/5 pt-3.5 space-y-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-white/40 block">
                        Uploaded File
                      </span>
                      <div className="flex items-center gap-2 text-xs text-white/70">
                        <FileText className="h-4 w-4 text-purple-400" />
                        <span>{uploadedFile.name}</span>
                      </div>
                    </div>
                  )}

                  {((teachingMode === "Human") || (teachingMode === "AI" && aiTab === "topics")) && (
                    <div className="border-t border-white/5 pt-3.5 space-y-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-white/40 block">
                        Topics Flow ({topics.length})
                      </span>
                      <ul className="space-y-1.5 text-xs text-white/60">
                        {topics.map((t, idx) => (
                          <li key={idx} className="flex items-center gap-2">
                            <span className="h-1.5 w-1.5 rounded-full bg-purple-500" />
                            {t}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {/* Session Code Panel */}
                <div className="grid gap-6 md:grid-cols-2 items-center">
                  {/* Code */}
                  <div className="space-y-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-white/60">
                      Session Code
                    </span>
                    <div className="flex items-center justify-between bg-purple-500/10 border border-purple-500/20 p-4 rounded-xl">
                      <span className="text-xl md:text-2xl font-mono font-bold tracking-widest text-purple-400">
                        {sessionCode}
                      </span>
                      <button
                        onClick={copyToClipboard}
                        className="p-2 rounded-lg bg-purple-500/15 text-purple-400 hover:bg-purple-500/25 transition-all cursor-pointer"
                        title="Copy Code"
                      >
                        {isCopied ? <Check className="h-4.5 w-4.5" /> : <Copy className="h-4.5 w-4.5" />}
                      </button>
                    </div>
                  </div>

                  {/* QR Code Placeholder */}
                  <div className="space-y-2 flex flex-col items-center md:items-end">
                    <span className="text-xs font-bold uppercase tracking-wider text-white/60 w-full text-center md:text-right">
                      QR Code Access
                    </span>
                    <div className="h-28 w-28 bg-[#111111] border border-white/5 rounded-xl flex flex-col items-center justify-center p-3 relative group">
                      <div className="grid grid-cols-5 gap-1.5 w-full h-full opacity-30 group-hover:opacity-50 transition-opacity">
                        {Array.from({ length: 25 }).map((_, i) => (
                          <div
                            key={i}
                            className={`rounded-sm ${(i % 3 === 0 || i % 7 === 0 || i < 5 || i > 20) ? "bg-purple-400" : "bg-transparent"}`}
                          />
                        ))}
                      </div>
                      <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white/60 uppercase tracking-widest pointer-events-none">
                        Scan Code
                      </span>
                    </div>
                  </div>
                </div>

                {/* Share Options */}
                <div className="space-y-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-white/40 block">
                    Share Access
                  </span>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={handleCopyLink}
                      className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-white/5 bg-white/[0.01] hover:bg-white/[0.03] text-xs font-bold text-white transition-colors cursor-pointer"
                    >
                      <Share2 className="h-3.5 w-3.5 text-purple-400" />
                      Copy Invite Link
                    </button>

                    <a
                      href={`https://api.whatsapp.com/send?text=Join%20my%20ClassAI%20session%20using%20code:%20${sessionCode}%20at%20${getShareLink()}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-white/5 bg-white/[0.01] hover:bg-white/[0.03] text-xs font-bold text-white transition-colors"
                    >
                      <span className="text-emerald-400 text-sm font-semibold">WA</span>
                      WhatsApp
                    </a>

                    <a
                      href={`mailto:?subject=ClassAI%20Session%20Code&body=Hello,%20please%20join%20my%20class%20session%20on%20ClassAI.%20Code:%20${sessionCode}%20Link:%20${getShareLink()}`}
                      className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-white/5 bg-white/[0.01] hover:bg-white/[0.03] text-xs font-bold text-white transition-colors"
                    >
                      <span className="text-purple-400 text-sm font-semibold">@</span>
                      Email Invite
                    </a>
                  </div>
                </div>

                {/* Schedule Option Toggle */}
                <div className="pt-2 border-t border-white/5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-white">Schedule for Later</span>
                      <p className="text-[10px] text-white/30 mt-0.5">Pick a specific time for the class to start</p>
                    </div>
                    <button
                      onClick={() => setScheduleLater(!scheduleLater)}
                      className={`h-6 w-11 rounded-full p-0.5 transition-colors cursor-pointer relative ${
                        scheduleLater ? "bg-purple-600" : "bg-white/10"
                      }`}
                    >
                      <div
                        className={`h-5 w-5 rounded-full bg-white transition-transform ${
                          scheduleLater ? "translate-x-5" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>

                  {scheduleLater && (
                    <div className="flex items-center gap-3 bg-[#111111] p-4 rounded-xl border border-white/5 animate-slideDown">
                      <Calendar className="h-4.5 w-4.5 text-purple-400" />
                      <input
                        type="datetime-local"
                        required
                        value={scheduledDate}
                        onChange={(e) => setScheduledDate(e.target.value)}
                        className="bg-transparent text-xs text-white focus:outline-none cursor-pointer w-full scheme-dark"
                      />
                    </div>
                  )}
                </div>

                {/* Final Launch Actions */}
                <div className="space-y-4 pt-4">
                  <button
                    onClick={handleLaunch}
                    disabled={isSubmitting}
                    className="w-full flex items-center justify-center gap-1.5 py-3.5 rounded-xl bg-purple-600 hover:bg-purple-500 font-bold text-sm text-white shadow-md shadow-purple-600/20 hover:shadow-purple-600/30 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {isSubmitting ? "Launching..." : !scheduleLater ? "Start Now" : "Confirm Schedule"}
                  </button>

                  <button
                    type="button"
                    onClick={() => setStep(3)}
                    className="w-full text-center text-xs font-semibold text-white/40 hover:text-white/60 transition-colors cursor-pointer"
                  >
                    Back to Content
                  </button>
                </div>

              </div>
            )}

          </div>
        </main>
      </div>
    </div>
  )

  // Render method for draggable topic list
  function renderTopicsList() {
    return (
      <div className="space-y-4 animate-fadeIn">
        <div className="space-y-3.5">
          {topics.map((topic, index) => (
            <div
              key={index}
              draggable
              onDragStart={(e) => handleDragStart(e, index)}
              onDragEnter={(e) => handleDragEnter(e, index)}
              onDragEnd={handleDragEnd}
              onDragOver={(e) => e.preventDefault()}
              className={`flex items-center gap-3 bg-[#111111] border border-white/5 p-3 rounded-xl transition-all ${
                draggedIndex === index
                  ? "opacity-40 border-dashed border-purple-500"
                  : "hover:border-white/10"
              }`}
            >
              <button
                type="button"
                className="text-white/20 hover:text-white/40 cursor-grab active:cursor-grabbing transition-colors"
              >
                <GripVertical className="h-4.5 w-4.5" />
              </button>

              <span className="h-6 w-6 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center text-xs font-bold">
                {index + 1}
              </span>

              <input
                type="text"
                required
                value={topic}
                onChange={(e) => handleTopicChange(index, e.target.value)}
                placeholder={`Topic #${index + 1} description`}
                className="flex-1 bg-transparent text-sm text-white placeholder-white/20 focus:outline-none"
              />

              {topics.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeTopicField(index)}
                  className="text-white/20 hover:text-red-400 transition-colors cursor-pointer"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </div>

        {topics.length < 10 && (
          <button
            type="button"
            onClick={addTopicField}
            className="flex items-center gap-1.5 px-4.5 py-2.5 rounded-xl border border-dashed border-purple-500/30 text-purple-400 hover:text-purple-300 hover:border-purple-500/50 text-xs font-bold transition-all cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            Add another topic
          </button>
        )}

        <div className="space-y-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-white/40">
            Suggested Topics
          </span>
          <div className="flex flex-wrap gap-2">
            {SUGGESTED_TOPICS.map((sug) => (
              <button
                key={sug}
                type="button"
                onClick={() => handleSuggestionClick(sug)}
                className="px-3 py-1.5 text-[10px] font-bold rounded-lg bg-white/[0.02] border border-white/5 text-white/50 hover:bg-white/[0.04] hover:text-white transition-colors cursor-pointer"
              >
                + {sug}
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }
}
