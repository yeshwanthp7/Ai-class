"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import {
  ArrowLeft,
  ArrowRight,
  Trash2,
  Menu,
  Upload,
  FileText,
} from "lucide-react"
import DashboardSidebar from "@/components/dashboard-sidebar"
import { subscribeToAuthChanges } from "@/lib/auth-service"
import { createSession } from "@/lib/session-service"
import { saveFile } from "@/lib/fileStorage"

export default function CreateSessionPage() {
  const [user, setUser] = useState<any>(null)
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Configuration State
  const [duration, setDuration] = useState("60 min")
  const [customDuration, setCustomDuration] = useState("")
  const [sessionType, setSessionType] = useState<"Public" | "Private">("Public")
  const [uploadedFile, setUploadedFile] = useState<{ name: string; size: string; pages: number } | null>(null)

  // Load current auth state
  useEffect(() => {
    const unsubscribe = subscribeToAuthChanges((currentUser) => {
      setUser(currentUser)
    })
    return () => unsubscribe()
  }, [])

  // Generate a random session code
  const generateCode = () => {
    const chars = "ABCDEFGHJKLMNOPQRSTUVWXYZ23456789" // Exclude confusing chars
    let code = "CLASS-"
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return code
  }

  // Handle PDF/PPT file upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      await saveFile("session-pdf", file)
    } catch (err) {
      console.error("Failed to save file to IndexedDB:", err)
      alert("Failed to read file. Please try again.")
      return
    }

    const sizeStr = (file.size / 1024 / 1024).toFixed(1) + " MB"
    setUploadedFile({
      name: file.name,
      size: sizeStr,
      pages: 0, // We'll parse pages in the live classroom
    })
  }

  // Create session and launch directly
  const handleCreateAndLaunch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) {
      alert("You must be logged in to create a session.")
      return
    }

    if (!uploadedFile) {
      alert("Please upload a PDF/PPT document first so the AI can teach it.")
      return
    }

    setIsSubmitting(true)
    try {
      const activeDuration = duration === "Custom" ? `${customDuration} min` : duration
      const code = generateCode()
      
      // Derive a clean title from the uploaded filename (remove file extension)
      const cleanTitle = uploadedFile.name.replace(/\.[^/.]+$/, "")
      
      const extraSettings: any = {
        teachingMode: "AI",
        uploadedFile: uploadedFile
      }

      // Create session in backend
      const createPromise = createSession(
        user.uid,
        cleanTitle,
        "Document Study",
        "University",
        activeDuration,
        sessionType,
        [], // no manual topics list, we are in PDF mode
        code,
        undefined,
        extraSettings
      )

      await Promise.race([
        createPromise,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Database connection timed out. Please try again.")), 8000)
        )
      ])
      
      // Go directly to the classroom!
      window.location.href = `/session/${code}`
    } catch (err: any) {
      console.warn("Session creation failed:", err)
      alert("Failed to create session: " + err.message)
      setIsSubmitting(false)
    }
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
        <header className="h-16 border-b border-white/5 bg-[#111111]/80 backdrop-blur-xl px-6 md:px-8 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsMobileSidebarOpen(true)}
              className="p-1.5 rounded-lg border border-white/10 hover:bg-white/5 lg:hidden text-white/80 hover:text-white cursor-pointer"
            >
              <Menu className="h-5 w-5" />
            </button>
            
            <div className="flex items-center gap-3">
              <Link href="/dashboard" className="p-1 rounded-lg hover:bg-white/5 text-white/60 hover:text-white transition-colors">
                <ArrowLeft className="h-4.5 w-4.5" />
              </Link>
              <h1 className="text-base md:text-lg font-bold text-white tracking-tight">
                Launch AI Classroom
              </h1>
            </div>
          </div>
        </header>

        {/* Form Container */}
        <main className="flex-1 p-6 md:p-8 flex justify-center items-start lg:items-center bg-[#111111]">
          <div className="w-full max-w-[620px] bg-[#1a1a1a] border border-white/5 rounded-2xl p-6 md:p-8 space-y-6 shadow-xl shadow-black/10">
            
            {/* Header & Subtitle */}
            <div className="text-center space-y-1">
              <h2 className="text-xl md:text-2xl font-bold text-white tracking-tight">Launch AI Classroom</h2>
              <p className="text-xs text-white/40">Upload your slides or documents and start your class instantly</p>
            </div>

            <form onSubmit={handleCreateAndLaunch} className="space-y-6">
              
              {/* DOCUMENT UPLOAD */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-white/60 block">
                  Upload PDF or Presentation slides
                </label>
                
                {!uploadedFile ? (
                  <label className="border-2 border-dashed border-white/10 hover:border-purple-500/50 bg-[#111111]/50 rounded-xl p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-3 group relative">
                    <input
                      type="file"
                      accept=".pdf,.ppt,.pptx"
                      className="hidden"
                      required
                      onChange={handleFileUpload}
                    />
                    <div className="h-10 w-10 rounded-full bg-white/5 flex items-center justify-center text-white/40 group-hover:text-purple-400 group-hover:bg-purple-500/10 transition-all">
                      <Upload className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white">Click to upload lecture slides or PDF document</p>
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
                        <p className="text-[9px] text-white/40 font-medium">{uploadedFile.size}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="h-6 w-6 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center text-xs">
                        ✓
                      </span>
                      <button
                        type="button"
                        onClick={() => setUploadedFile(null)}
                        className="text-white/20 hover:text-red-400 p-1.5 transition-colors cursor-pointer"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* ESTIMATED DURATION */}
              <div className="space-y-3">
                <label className="text-xs font-bold uppercase tracking-wider text-white/60 block">
                  Estimated Class Duration
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
                      placeholder="Enter minutes"
                      className="w-32 px-4 py-2.5 bg-[#111111] border border-white/10 rounded-xl text-sm focus:outline-none focus:border-purple-500 text-white"
                    />
                    <span className="text-xs text-white/50 font-medium">minutes</span>
                  </div>
                )}
              </div>

              {/* SESSION TYPE */}
              <div className="space-y-3">
                <label className="text-xs font-bold uppercase tracking-wider text-white/60 block">
                  Access Controls
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
                    <span className="text-xs font-bold text-white">Public Access</span>
                    <span className="text-[10px] text-white/40 leading-tight">
                      Anyone with the room code can join the class
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
                    <span className="text-xs font-bold text-white">Private Access</span>
                    <span className="text-[10px] text-white/40 leading-tight">
                      Only invited students or emails can enter
                    </span>
                  </div>
                </div>
              </div>

              {/* LAUNCH BUTTON */}
              <div className="pt-4">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full flex items-center justify-center gap-1.5 py-3.5 rounded-xl bg-purple-600 hover:bg-purple-500 font-bold text-sm text-white shadow-md shadow-purple-600/20 hover:shadow-purple-600/30 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? "Creating AI Classroom..." : "Launch AI Class"}
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>

            </form>

          </div>
        </main>
      </div>
    </div>
  )
}
