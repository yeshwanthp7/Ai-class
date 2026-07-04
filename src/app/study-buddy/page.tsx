"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import Link from "next/link"
import { LogOut } from "lucide-react"
import AIStudyBuddy from "@/components/AIStudyBuddy"

export default function StudentStudyBuddyPage() {
  const [studentName, setStudentName] = useState("")

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
    <div className="min-h-screen bg-[#0A0A0A] font-sans antialiased text-white flex flex-col">
      {/* ─── Header ─── */}
      <header className="w-full border-b border-white/5 bg-black/10 backdrop-blur-sm sticky top-0 z-20 px-6 py-4 flex items-center justify-between">
        {/* Logo */}
        <Link
          href="/"
          className="flex items-center gap-2.5 border-l-2 border-purple-500/40 pl-3 drop-shadow-[0_0_8px_rgba(147,51,234,0.3)] hover:border-purple-500/70 transition-all"
        >
          <Image src="/logo.png" alt="Class AI" width={32} height={32} />
          <span className="text-lg font-bold tracking-tight text-white">
            Class<span className="text-purple-400">AI</span>{" "}
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-purple-500/10 border border-purple-500/20 text-purple-400 ml-1.5">
              Study Buddy
            </span>
          </span>
        </Link>

        {/* Profile Info */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <span className="text-white/40 font-normal">Welcome,</span>
            <span className="text-purple-400">{studentName}</span>
          </div>

          <button
            onClick={handleSignOut}
            className="flex items-center justify-center gap-2 px-3 py-1.5 rounded-xl border border-white/5 bg-white/[0.02] text-xs font-semibold text-white/70 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20 transition-all cursor-pointer"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign Out
          </button>
        </div>
      </header>

      {/* ─── Main Content ─── */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-6 md:p-8 flex flex-col items-center">
        <AIStudyBuddy isTeacher={false} />
      </main>
    </div>
  )
}
