"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import Link from "next/link"
import { LogOut, Eye, EyeOff, FileText } from "lucide-react"
import AIStudyBuddy from "@/components/AIStudyBuddy"

export default function StudentStudyBuddyPage() {
  const [studentName, setStudentName] = useState("")
  const [isStealthMode, setIsStealthMode] = useState(false)

  useEffect(() => {
    if (typeof window !== "undefined") {
      const name = localStorage.getItem("studentName")
      if (!name) {
        window.location.href = "/auth"
      } else {
        setStudentName(name)
      }
    }
  }, [])

  const handleSignOut = () => {
    localStorage.removeItem("studentName")
    localStorage.removeItem("studentId")
    window.location.href = "/auth"
  }

  if (!studentName) {
    return (
      <div className="flex h-screen bg-[#0A0A0A] items-center justify-center">
        <div className="h-8 w-8 rounded-full border border-purple-500 border-t-transparent animate-spin" />
      </div>
    )
  }

  return (
    <div className={`min-h-screen font-sans antialiased flex flex-col transition-colors duration-300 ${
      isStealthMode 
        ? "bg-[#F3F4F6] text-neutral-800" 
        : "bg-[#0A0A0A] text-white"
    }`}>
      {/* ─── Header ─── */}
      <header className={`w-full sticky top-0 z-20 px-6 py-4 flex items-center justify-between border-b transition-all duration-300 ${
        isStealthMode 
          ? "bg-white border-neutral-200 text-neutral-800 shadow-sm" 
          : "bg-black/10 border-white/5 backdrop-blur-sm text-white"
      }`}>
        {/* Logo / Title */}
        {isStealthMode ? (
          <div className="flex items-center gap-2.5 pl-1 text-neutral-700">
            <FileText className="h-5 w-5 text-neutral-500" />
            <span className="text-sm font-bold tracking-tight text-neutral-700">
              Document Viewer <span className="text-xs font-normal text-neutral-400 ml-1.5 px-2 py-0.5 rounded bg-neutral-100 border border-neutral-200">v3.42</span>
            </span>
          </div>
        ) : (
          <Link
            href="/"
            className="flex items-center gap-2.5 border-l-2 border-purple-500/40 pl-3 drop-shadow-[0_0_8px_rgba(37,99,235,0.3)] hover:border-purple-500/70 transition-all"
          >
            <Image src="/logo.png" alt="Class AI" width={32} height={32} />
            <span className="text-lg font-bold tracking-tight text-white">
              Class<span className="text-purple-400">AI</span>{" "}
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-purple-500/10 border border-purple-500/20 text-purple-400 ml-1.5">
                Study Buddy
              </span>
            </span>
          </Link>
        )}

        {/* Profile Info & Stealth Toggle */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => setIsStealthMode(!isStealthMode)}
            className={`flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
              isStealthMode
                ? "bg-neutral-100 border-neutral-300 text-neutral-700 hover:bg-neutral-200"
                : "bg-purple-500/10 border-purple-500/20 text-purple-400 hover:bg-purple-500/20 hover:text-purple-300"
            }`}
            title={isStealthMode ? "Exit Discreet Mode" : "Enter Discreet Mode"}
          >
            {isStealthMode ? (
              <>
                <Eye className="h-3.5 w-3.5" />
                Show AI Panel
              </>
            ) : (
              <>
                <EyeOff className="h-3.5 w-3.5 animate-pulse" />
                Reader View (Stealth)
              </>
            )}
          </button>

          <div className="flex items-center gap-2 text-sm font-semibold">
            <span className={isStealthMode ? "text-neutral-400 font-normal" : "text-white/40 font-normal"}>Welcome,</span>
            <span className={isStealthMode ? "text-neutral-800" : "text-purple-400"}>{studentName}</span>
          </div>

          <button
            onClick={handleSignOut}
            className={`flex items-center justify-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer border transition-all ${
              isStealthMode
                ? "bg-white border-neutral-300 text-neutral-600 hover:bg-red-50 hover:text-red-500 hover:border-red-200"
                : "bg-white/[0.02] border-white/5 text-white/70 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20"
            }`}
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign Out
          </button>
        </div>
      </header>

      {/* ─── Main Content ─── */}
      <main className={`flex-1 w-full mx-auto p-6 md:p-8 flex flex-col items-center transition-all duration-300 ${
        isStealthMode ? "max-w-7xl" : "max-w-6xl"
      }`}>
        <AIStudyBuddy isTeacher={false} isStealthMode={isStealthMode} />
      </main>
    </div>
  )
}
