"use client"

import { useState, useEffect, useCallback } from "react"
import Image from "next/image"
import Link from "next/link"
import { ArrowLeft, Sparkles, Loader2, AlertCircle } from "lucide-react"
import {
  signInWithGoogle,
  signInWithEmail,
  signUpWithEmail,
} from "@/lib/auth-service"
import { joinSession } from "@/lib/session-service"
import { LoadingScreen } from "@/components/ui/loading-screen"

export default function AuthPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [tab, setTab] = useState<"teacher" | "student">("teacher")
  const [teacherMode, setTeacherMode] = useState<"signin" | "signup">("signin")
  const [studentFlow, setStudentFlow] = useState<"select" | "live" | "self-learn">("select")
  const [studentMode, setStudentMode] = useState<"signin" | "signup">("signin")

  const handleLoadingComplete = useCallback(() => {
    setIsLoading(false)
  }, [])

  // Form states
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [sessionCode, setSessionCode] = useState("")

  // Status states
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isFirebaseConfigured, setIsFirebaseConfigured] = useState(true)

  // Handle URL query parameters for initial mode
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search)
      const mode = params.get("mode")
      if (mode === "signup") {
        setTeacherMode("signup")
      }
      const role = params.get("role")
      if (role === "student") {
        setTab("student")
      }
      const code = params.get("code")
      if (code) {
        setSessionCode(code.toUpperCase())
      }
    }
  }, [])

  // Check if Firebase is configured with real credentials on client mount
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_FIREBASE_API_KEY
    if (
      !key ||
      key === "your-api-key" ||
      key === "AIzaSyDummyKeyForBuildSafetyOnly"
    ) {
      setIsFirebaseConfigured(false)
    } else {
      setIsFirebaseConfigured(true)
    }
  }, [])

  // Clear status on view switch
  useEffect(() => {
    setError(null)
    setSuccess(null)
    setStudentFlow("select")
  }, [tab, teacherMode, studentMode])

  // Sign in with Google
  const handleGoogleSignIn = async () => {
    try {
      const user = await signInWithGoogle()
      
      if (!user) {
        setIsSubmitting(true)
        setSuccess("Redirecting to Google...")
        return
      }

      setError(null)
      setIsSubmitting(true)
      setSuccess(`Signed in successfully as ${user.displayName || user.email}!`)
      
      localStorage.setItem("studentName", user.displayName || "Student")
      localStorage.setItem("studentId", user.uid)

      // Redirect after brief delay to show success
      setTimeout(() => {
        window.location.href = tab === "student" ? "/study-buddy" : "/dashboard"
      }, 1500)
    } catch (err: any) {
      console.error(err)
      setIsSubmitting(false)
      if (err.code === "auth/popup-closed-by-user") {
        setError("Sign-in popup closed before completion. Please try again.")
      } else {
        setError(err.message || "Failed to sign in with Google.")
      }
    }
  }

  // Handle form submissions
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setIsSubmitting(true)

    try {
      if (tab === "teacher") {
        if (!isFirebaseConfigured) {
          throw new Error("Firebase credentials are not configured. Please set up your .env.local file.")
        }
        if (teacherMode === "signin") {
          // Teacher Sign In
          const user = await signInWithEmail(email, password)
          setSuccess(`Signed in successfully as ${user.displayName || user.email}!`)
          setTimeout(() => {
            window.location.href = "/dashboard"
          }, 1500)
        } else {
          // Teacher Sign Up
          if (password !== confirmPassword) {
            throw new Error("Passwords do not match.")
          }
          if (password.length < 6) {
            throw new Error("Password must be at least 6 characters.")
          }
          const user = await signUpWithEmail(email, password, name)
          setSuccess(`Account created successfully for ${user.displayName}! Redirecting...`)
          setTimeout(() => {
            window.location.href = "/dashboard"
          }, 1500)
        }
      } else {
        // Student Flow
        if (studentFlow === "self-learn") {
          if (!isFirebaseConfigured) {
            throw new Error("Firebase credentials are not configured. Please set up your .env.local file.")
          }

          if (studentMode === "signin") {
            const user = await signInWithEmail(email, password)
            localStorage.setItem("studentName", user.displayName || "Student")
            localStorage.setItem("studentId", user.uid)
            setSuccess(`Signed in successfully as ${user.displayName || user.email}! Opening Study Buddy...`)
            setTimeout(() => {
              window.location.href = "/study-buddy"
            }, 1500)
          } else {
            if (password !== confirmPassword) {
              throw new Error("Passwords do not match.")
            }
            if (password.length < 6) {
              throw new Error("Password must be at least 6 characters.")
            }
            const user = await signUpWithEmail(email, password, name)
            localStorage.setItem("studentName", name)
            localStorage.setItem("studentId", user.uid)
            setSuccess(`Account created successfully for ${user.displayName}! Opening Study Buddy...`)
            setTimeout(() => {
              window.location.href = "/study-buddy"
            }, 1500)
          }
          return
        }

        // Student Join Live Class
        if (!name.trim()) {
          throw new Error("Please enter your name.")
        }
        if (!sessionCode.trim()) {
          throw new Error("Please enter a session code.")
        }
        
        const formattedCode = sessionCode.trim().toUpperCase()
        const joinPromise = joinSession(name, formattedCode)
        
        const studentId = await Promise.race([
          joinPromise,
          new Promise<string>((_, reject) =>
            setTimeout(() => reject(new Error("Database connection timed out. Please check your internet connection or ensure that the session code is correct and the database is active.")), 8000)
          )
        ])
        
        localStorage.setItem("studentName", name)
        localStorage.setItem("studentId", studentId)
        
        setSuccess(`Joining session ${formattedCode} as ${name}...`)
        setTimeout(() => {
          window.location.href = `/session/${formattedCode}`
        }, 1500)
      }
    } catch (err: any) {
      console.warn("Authentication or database error:", err)
      if (err.code === "auth/invalid-credential") {
        setError("Invalid email address or password.")
      } else if (err.code === "auth/email-already-in-use") {
        setError("An account with this email address already exists.")
      } else if (err.code === "auth/invalid-email") {
        setError("Please enter a valid email address.")
      } else if (err.code === "auth/weak-password") {
        setError("Password must be at least 6 characters.")
      } else {
        setError(err.message || "An error occurred. Please check your credentials.")
      }
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <LoadingScreen onComplete={handleLoadingComplete} />

      <div
        className={`flex min-h-screen bg-[#0A0A0A] font-sans antialiased text-white transition-opacity duration-700 ${
          isLoading ? "opacity-0" : "opacity-100"
        }`}
      >
        {/* ─── Left Side: Branding, Testimonial & Stats ─── */}
        <div className="relative hidden w-1/2 flex-col justify-between border-r border-[#1a1a1a] bg-[#0A0A0A] p-16 lg:flex overflow-hidden">
          {/* Subtle glowing backgrounds */}
          <div className="absolute -left-1/4 -bottom-1/4 pointer-events-none -z-10 h-[80%] w-[80%] rounded-full bg-purple-500/10 blur-[120px]" />
          <div className="absolute right-0 top-0 pointer-events-none -z-10 h-[50%] w-[50%] rounded-full bg-violet-500/5 blur-[100px]" />

          {/* Back Link */}
          <div className="relative z-10">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-sm text-white/50 transition-colors hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Home
            </Link>
          </div>

          {/* Branding & Quote */}
          <div className="relative z-10 my-auto flex flex-col gap-8">
            {/* Brand Logo */}
            <div className="flex items-center gap-2.5 border-l-2 border-purple-500/40 pl-3 drop-shadow-[0_0_8px_rgba(147,51,234,0.3)]">
              <Image src="/logo.png" alt="Class AI" width={36} height={36} />
              <span className="text-xl font-bold tracking-tight text-white">
                Class<span className="text-purple-400">AI</span>
              </span>
            </div>

            {/* Large Quote */}
            <div>
              <blockquote className="text-3xl font-medium leading-relaxed text-white/90">
                “Our students are more engaged than ever”
              </blockquote>
              <cite className="mt-4 block text-base font-medium text-purple-400/80 not-italic">
                — Sarah K., High School Teacher
              </cite>
            </div>
          </div>

          {/* Stat Pills */}
          <div className="relative z-10 flex flex-wrap gap-3 mt-auto">
            <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white/80 backdrop-blur-sm shadow-sm">
              10k+ Students
            </span>
            <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white/80 backdrop-blur-sm shadow-sm">
              500+ Teachers
            </span>
            <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white/80 backdrop-blur-sm shadow-sm">
              4.9★ Rating
            </span>
          </div>
        </div>

        {/* ─── Right Side: White Card Center ─── */}
        <div className="relative flex flex-1 flex-col justify-center items-center p-6 sm:p-12 bg-[#0A0A0A] overflow-hidden">
          {/* Glow behind the card */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none -z-10 h-[500px] w-[500px] rounded-full bg-purple-500/5 blur-[120px]" />

          {/* Back link for mobile view */}
          <div className="absolute top-6 left-6 z-10 lg:hidden">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-xs text-white/50 transition-colors hover:text-white"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Home
            </Link>
          </div>

          {/* Main Card */}
          <div className="relative z-10 w-full max-w-md bg-white text-neutral-900 rounded-2xl border border-neutral-100 p-8 shadow-2xl transition-all duration-300">
            {/* Card Top Logo */}
            <div className="flex flex-col items-center mb-6">
              <div className="flex items-center gap-2 mb-2">
                <Image src="/logo.png" alt="Class AI" width={32} height={32} />
                <span className="text-xl font-bold tracking-tight text-neutral-900">
                  Class<span className="text-purple-600">AI</span>
                </span>
              </div>
            </div>

            {/* Form Tabs */}
            <div className="grid grid-cols-2 gap-1 rounded-xl bg-neutral-100 p-1 mb-6">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setTab("teacher")}
                className={`rounded-lg py-2 text-sm font-semibold transition-all cursor-pointer ${
                  tab === "teacher"
                    ? "bg-white text-neutral-900 shadow-sm"
                    : "text-neutral-500 hover:text-neutral-900 disabled:opacity-50"
                }`}
              >
                Teacher
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setTab("student")}
                className={`rounded-lg py-2 text-sm font-semibold transition-all cursor-pointer ${
                  tab === "student"
                    ? "bg-white text-neutral-900 shadow-sm"
                    : "text-neutral-500 hover:text-neutral-900 disabled:opacity-50"
                }`}
              >
                I'm a Student
              </button>
            </div>

            {/* Configuration Warning Alert Banner */}
            {!isFirebaseConfigured && tab === "teacher" && (
              <div className="mb-6 rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-800 animate-pulse-slow">
                <div className="flex gap-2 font-bold mb-1 items-center">
                  <AlertCircle className="h-4 w-4 text-amber-600 flex-shrink-0" />
                  Firebase Credentials Required
                </div>
                <p className="text-xs leading-relaxed text-amber-700">
                  Please duplicate the <code className="bg-amber-100/80 px-1 py-0.5 rounded font-mono font-semibold">.env.local.example</code> file to <code className="bg-amber-100/80 px-1 py-0.5 rounded font-mono font-semibold">.env.local</code> and fill in your Firebase API credentials.
                </p>
              </div>
            )}

            {/* Error and Success status notifications */}
            {error && (
              <div className="mb-4 rounded-lg bg-rose-50 border border-rose-100 p-3 text-xs font-semibold text-rose-600">
                {error}
              </div>
            )}

            {success && (
              <div className="mb-4 rounded-lg bg-emerald-50 border border-emerald-100 p-3 text-xs font-semibold text-emerald-700 flex items-center gap-2">
                <Loader2 className="h-3 w-3 animate-spin text-emerald-500" />
                {success}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              {/* ─── CASE: TEACHER FLOW ─── */}
              {tab === "teacher" && (
                <>
                  {/* SIGN IN MODE */}
                  {teacherMode === "signin" && (
                    <div className="space-y-4">
                      <div className="text-center mb-6">
                        <h2 className="text-2xl font-bold text-neutral-950">Welcome back</h2>
                        <p className="text-sm text-neutral-500 mt-1">Sign in to manage your classrooms</p>
                      </div>

                      {/* Google Button */}
                      <button
                        type="button"
                        disabled={isSubmitting || !isFirebaseConfigured}
                        onClick={handleGoogleSignIn}
                        className="w-full h-[52px] bg-white border border-neutral-200 rounded-lg text-neutral-800 font-semibold flex items-center justify-center gap-3 transition-colors hover:bg-neutral-50 hover:border-neutral-300 shadow-sm cursor-pointer disabled:opacity-50"
                      >
                        {isSubmitting ? (
                          <Loader2 className="h-5 w-5 animate-spin text-purple-600" />
                        ) : (
                          <svg className="h-5 w-5 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                            <path
                              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                              fill="#4285F4"
                            />
                            <path
                              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                              fill="#34A853"
                            />
                            <path
                              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                              fill="#FBBC05"
                            />
                            <path
                              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                              fill="#EA4335"
                            />
                          </svg>
                        )}
                        Continue with Google
                      </button>

                      <div className="relative my-6 py-2">
                        <div className="absolute inset-0 flex items-center">
                          <div className="w-full border-t border-neutral-200" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                          <span className="bg-white px-3 text-neutral-400 font-medium">or</span>
                        </div>
                      </div>

                      {/* Email */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-neutral-700 uppercase tracking-wider">Email Address</label>
                        <input
                          type="email"
                          required
                          disabled={isSubmitting || !isFirebaseConfigured}
                          placeholder="teacher@school.edu"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="w-full px-3.5 py-2.5 text-sm bg-white border border-neutral-200 rounded-lg text-neutral-900 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-colors disabled:opacity-50"
                        />
                      </div>

                      {/* Password */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-neutral-700 uppercase tracking-wider">Password</label>
                        <input
                          type="password"
                          required
                          disabled={isSubmitting || !isFirebaseConfigured}
                          placeholder="••••••••"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="w-full px-3.5 py-2.5 text-sm bg-white border border-neutral-200 rounded-lg text-neutral-900 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-colors disabled:opacity-50"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={isSubmitting || !isFirebaseConfigured}
                        className="w-full h-11 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg transition-colors mt-6 shadow-md shadow-purple-500/10 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                        {isSubmitting ? "Signing In..." : "Sign In"}
                      </button>

                      <p className="text-sm text-neutral-500 text-center mt-6 pt-2 border-t border-neutral-100">
                        Don't have an account?{" "}
                        <button
                          type="button"
                          disabled={isSubmitting}
                          onClick={() => setTeacherMode("signup")}
                          className="font-semibold text-purple-600 hover:text-purple-700 transition-colors cursor-pointer disabled:opacity-50"
                        >
                          Sign up as Teacher
                        </button>
                      </p>
                    </div>
                  )}

                  {/* SIGN UP MODE */}
                  {teacherMode === "signup" && (
                    <div className="space-y-4">
                      <div className="text-center mb-6">
                        <h2 className="text-2xl font-bold text-neutral-950">Create account</h2>
                        <p className="text-sm text-neutral-500 mt-1">Get started with ClassAI today</p>
                      </div>

                      {/* Google Button */}
                      <button
                        type="button"
                        disabled={isSubmitting || !isFirebaseConfigured}
                        onClick={handleGoogleSignIn}
                        className="w-full h-[52px] bg-white border border-neutral-200 rounded-lg text-neutral-800 font-semibold flex items-center justify-center gap-3 transition-colors hover:bg-neutral-50 hover:border-neutral-300 shadow-sm cursor-pointer disabled:opacity-50"
                      >
                        {isSubmitting ? (
                          <Loader2 className="h-5 w-5 animate-spin text-purple-600" />
                        ) : (
                          <svg className="h-5 w-5 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                            <path
                              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                              fill="#4285F4"
                            />
                            <path
                              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                              fill="#34A853"
                            />
                            <path
                              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                              fill="#FBBC05"
                            />
                            <path
                              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                              fill="#EA4335"
                            />
                          </svg>
                        )}
                        Continue with Google
                      </button>

                      <div className="relative my-6 py-2">
                        <div className="absolute inset-0 flex items-center">
                          <div className="w-full border-t border-neutral-200" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                          <span className="bg-white px-3 text-neutral-400 font-medium">or</span>
                        </div>
                      </div>

                      {/* Full Name */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-neutral-700 uppercase tracking-wider">Full Name</label>
                        <input
                          type="text"
                          required
                          disabled={isSubmitting || !isFirebaseConfigured}
                          placeholder="Dr. Sarah Jenkins"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          className="w-full px-3.5 py-2.5 text-sm bg-white border border-neutral-200 rounded-lg text-neutral-900 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-colors disabled:opacity-50"
                        />
                      </div>

                      {/* Email */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-neutral-700 uppercase tracking-wider">Email Address</label>
                        <input
                          type="email"
                          required
                          disabled={isSubmitting || !isFirebaseConfigured}
                          placeholder="you@school.edu"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="w-full px-3.5 py-2.5 text-sm bg-white border border-neutral-200 rounded-lg text-neutral-900 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-colors disabled:opacity-50"
                        />
                      </div>

                      {/* Password */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-neutral-700 uppercase tracking-wider">Password</label>
                        <input
                          type="password"
                          required
                          disabled={isSubmitting || !isFirebaseConfigured}
                          placeholder="••••••••"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="w-full px-3.5 py-2.5 text-sm bg-white border border-neutral-200 rounded-lg text-neutral-900 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-colors disabled:opacity-50"
                        />
                      </div>

                      {/* Confirm Password */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-neutral-700 uppercase tracking-wider">Confirm Password</label>
                        <input
                          type="password"
                          required
                          disabled={isSubmitting || !isFirebaseConfigured}
                          placeholder="••••••••"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className="w-full px-3.5 py-2.5 text-sm bg-white border border-neutral-200 rounded-lg text-neutral-900 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-colors disabled:opacity-50"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={isSubmitting || !isFirebaseConfigured}
                        className="w-full h-11 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg transition-colors mt-6 shadow-md shadow-purple-500/10 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                        {isSubmitting ? "Creating Account..." : "Create Account"}
                      </button>

                      <p className="text-sm text-neutral-500 text-center mt-6 pt-2 border-t border-neutral-100">
                        Already have an account?{" "}
                        <button
                          type="button"
                          disabled={isSubmitting}
                          onClick={() => setTeacherMode("signin")}
                          className="font-semibold text-purple-600 hover:text-purple-700 transition-colors cursor-pointer disabled:opacity-50"
                        >
                          Sign in
                        </button>
                      </p>
                    </div>
                  )}
                </>
              )}

              {/* ─── CASE: STUDENT FLOW ─── */}
              {tab === "student" && (
                <div className="space-y-4">
                  {/* 1. SELECTION STATE */}
                  {studentFlow === "select" && (
                    <div className="space-y-6">
                      <div className="text-center mb-6">
                        <h2 className="text-2xl font-bold text-neutral-900">Welcome, Student!</h2>
                        <p className="text-sm text-neutral-500 mt-1">How would you like to study today?</p>
                      </div>

                      <div className="space-y-4">
                        {/* Option A: Join Live Class */}
                        <button
                          type="button"
                          onClick={() => setStudentFlow("live")}
                          className="w-full text-left p-5 border border-neutral-100 rounded-xl bg-white hover:bg-neutral-50/50 hover:border-neutral-200 transition-all shadow-sm flex flex-col gap-1.5 cursor-pointer"
                        >
                          <span className="text-sm font-bold text-neutral-900">Join a Live Class</span>
                          <span className="text-xs text-neutral-500 leading-relaxed">
                            Enter a code provided by your teacher to join the classroom session.
                          </span>
                        </button>

                        {/* Option B: Self Learn / AI Study Buddy */}
                        <button
                          type="button"
                          onClick={() => setStudentFlow("self-learn")}
                          className="w-full text-left p-5 border border-neutral-100 rounded-xl bg-white hover:bg-neutral-50/50 hover:border-neutral-200 transition-all shadow-sm flex flex-col gap-1.5 cursor-pointer"
                        >
                          <span className="text-sm font-bold text-neutral-900">Self Learn (AI Study Buddy)</span>
                          <span className="text-xs text-neutral-500 leading-relaxed">
                            Upload slides, notes, or PDFs to get instant shortcut explanations, images & doubt chat.
                          </span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* 2. JOIN LIVE CLASS STATE */}
                  {studentFlow === "live" && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between mb-4">
                        <button
                          type="button"
                          onClick={() => setStudentFlow("select")}
                          className="inline-flex items-center gap-1 text-xs text-purple-600 font-bold hover:text-purple-700 cursor-pointer"
                        >
                          <ArrowLeft className="h-3 w-3" /> Back
                        </button>
                        <span className="text-xs text-neutral-400 font-semibold uppercase">Live Class</span>
                      </div>

                      <div className="text-center mb-6">
                        <h2 className="text-2xl font-bold text-neutral-950">Join a Live Class</h2>
                        <p className="text-sm text-neutral-500 mt-1">Enter details to enter the live class</p>
                      </div>

                      {/* Student Name */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-neutral-700 uppercase tracking-wider">Your Name</label>
                        <input
                          type="text"
                          required
                          disabled={isSubmitting}
                          placeholder="Enter your name"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          className="w-full px-3.5 py-2.5 text-sm bg-white border border-neutral-200 rounded-lg text-neutral-900 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-colors disabled:opacity-50"
                        />
                      </div>

                      {/* Session Code */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-neutral-700 uppercase tracking-wider">Session Code</label>
                        <input
                          type="text"
                          required
                          maxLength={10}
                          disabled={isSubmitting}
                          placeholder="CLASS-XXXX"
                          value={sessionCode}
                          onChange={(e) => setSessionCode(e.target.value)}
                          className="w-full px-3.5 py-3 text-center font-mono text-2xl font-bold tracking-widest uppercase bg-white border border-neutral-200 rounded-lg text-neutral-900 placeholder-neutral-300 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all disabled:opacity-50"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full h-12 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg transition-colors mt-6 shadow-md shadow-purple-500/10 cursor-pointer disabled:opacity-75 flex items-center justify-center gap-2"
                      >
                        {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                        {isSubmitting ? "Joining..." : "Join Class"}
                      </button>
                    </div>
                  )}

                  {/* 3. SELF LEARN / STUDY BUDDY STATE (FULL LOGIN SYSTEM) */}
                  {studentFlow === "self-learn" && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between mb-4">
                        <button
                          type="button"
                          onClick={() => setStudentFlow("select")}
                          className="inline-flex items-center gap-1 text-xs text-purple-600 font-bold hover:text-purple-700 cursor-pointer"
                        >
                          <ArrowLeft className="h-3 w-3" /> Back
                        </button>
                        <span className="text-xs text-neutral-400 font-semibold uppercase">Self Learn Account</span>
                      </div>

                      {studentMode === "signin" ? (
                        <div className="space-y-4">
                          <div className="text-center mb-6">
                            <h2 className="text-2xl font-bold text-neutral-950">Student Login</h2>
                            <p className="text-sm text-neutral-500 mt-1">Sign in to access your study room</p>
                          </div>

                          {/* Google Button */}
                          <button
                            type="button"
                            disabled={isSubmitting || !isFirebaseConfigured}
                            onClick={handleGoogleSignIn}
                            className="w-full h-[52px] bg-white border border-neutral-200 rounded-lg text-neutral-800 font-semibold flex items-center justify-center gap-3 transition-colors hover:bg-neutral-50 hover:border-neutral-300 shadow-sm cursor-pointer disabled:opacity-50"
                          >
                            {isSubmitting ? (
                              <Loader2 className="h-5 w-5 animate-spin text-purple-600" />
                            ) : (
                              <svg className="h-5 w-5 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                                <path
                                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                  fill="#4285F4"
                                />
                                <path
                                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                  fill="#34A853"
                                />
                                <path
                                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                                  fill="#FBBC05"
                                />
                                <path
                                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                                  fill="#EA4335"
                                />
                              </svg>
                            )}
                            Continue with Google
                          </button>

                          <div className="relative my-6 py-2">
                            <div className="absolute inset-0 flex items-center">
                              <div className="w-full border-t border-neutral-200" />
                            </div>
                            <div className="relative flex justify-center text-xs uppercase">
                              <span className="bg-white px-3 text-neutral-400 font-medium">or</span>
                            </div>
                          </div>

                          {/* Email */}
                          <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-neutral-700 uppercase tracking-wider">Email Address</label>
                            <input
                              type="email"
                              required
                              disabled={isSubmitting || !isFirebaseConfigured}
                              placeholder="student@school.edu"
                              value={email}
                              onChange={(e) => setEmail(e.target.value)}
                              className="w-full px-3.5 py-2.5 text-sm bg-white border border-neutral-200 rounded-lg text-neutral-900 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-colors disabled:opacity-50"
                            />
                          </div>

                          {/* Password */}
                          <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-neutral-700 uppercase tracking-wider">Password</label>
                            <input
                              type="password"
                              required
                              disabled={isSubmitting || !isFirebaseConfigured}
                              placeholder="••••••••"
                              value={password}
                              onChange={(e) => setPassword(e.target.value)}
                              className="w-full px-3.5 py-2.5 text-sm bg-white border border-neutral-200 rounded-lg text-neutral-900 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-colors disabled:opacity-50"
                            />
                          </div>

                          <button
                            type="submit"
                            disabled={isSubmitting || !isFirebaseConfigured}
                            className="w-full h-11 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg transition-colors mt-6 shadow-md shadow-purple-500/10 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                          >
                            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                            {isSubmitting ? "Signing In..." : "Sign In"}
                          </button>

                          <p className="text-sm text-neutral-500 text-center mt-6 pt-2 border-t border-neutral-100">
                            Don't have an account?{" "}
                            <button
                              type="button"
                              disabled={isSubmitting}
                              onClick={() => setStudentMode("signup")}
                              className="font-semibold text-purple-600 hover:text-purple-700 transition-colors cursor-pointer disabled:opacity-50"
                            >
                              Sign up as Student
                            </button>
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <div className="text-center mb-6">
                            <h2 className="text-2xl font-bold text-neutral-950">Student Register</h2>
                            <p className="text-sm text-neutral-500 mt-1">Create an account to save study rooms</p>
                          </div>

                          {/* Google Button */}
                          <button
                            type="button"
                            disabled={isSubmitting || !isFirebaseConfigured}
                            onClick={handleGoogleSignIn}
                            className="w-full h-[52px] bg-white border border-neutral-200 rounded-lg text-neutral-800 font-semibold flex items-center justify-center gap-3 transition-colors hover:bg-neutral-50 hover:border-neutral-300 shadow-sm cursor-pointer disabled:opacity-50"
                          >
                            {isSubmitting ? (
                              <Loader2 className="h-5 w-5 animate-spin text-purple-600" />
                            ) : (
                              <svg className="h-5 w-5 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                                <path
                                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                  fill="#4285F4"
                                />
                                <path
                                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                  fill="#34A853"
                                />
                                <path
                                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                                  fill="#FBBC05"
                                />
                                <path
                                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                                  fill="#EA4335"
                                />
                              </svg>
                            )}
                            Continue with Google
                          </button>

                          <div className="relative my-6 py-2">
                            <div className="absolute inset-0 flex items-center">
                              <div className="w-full border-t border-neutral-200" />
                            </div>
                            <div className="relative flex justify-center text-xs uppercase">
                              <span className="bg-white px-3 text-neutral-400 font-medium">or</span>
                            </div>
                          </div>

                          {/* Full Name */}
                          <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-neutral-700 uppercase tracking-wider">Your Name</label>
                            <input
                              type="text"
                              required
                              disabled={isSubmitting || !isFirebaseConfigured}
                              placeholder="Alex Smith"
                              value={name}
                              onChange={(e) => setName(e.target.value)}
                              className="w-full px-3.5 py-2.5 text-sm bg-white border border-neutral-200 rounded-lg text-neutral-900 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-colors disabled:opacity-50"
                            />
                          </div>

                          {/* Email */}
                          <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-neutral-700 uppercase tracking-wider">Email Address</label>
                            <input
                              type="email"
                              required
                              disabled={isSubmitting || !isFirebaseConfigured}
                              placeholder="alex@school.edu"
                              value={email}
                              onChange={(e) => setEmail(e.target.value)}
                              className="w-full px-3.5 py-2.5 text-sm bg-white border border-neutral-200 rounded-lg text-neutral-900 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-colors disabled:opacity-50"
                            />
                          </div>

                          {/* Password */}
                          <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-neutral-700 uppercase tracking-wider">Password</label>
                            <input
                              type="password"
                              required
                              disabled={isSubmitting || !isFirebaseConfigured}
                              placeholder="••••••••"
                              value={password}
                              onChange={(e) => setPassword(e.target.value)}
                              className="w-full px-3.5 py-2.5 text-sm bg-white border border-neutral-200 rounded-lg text-neutral-900 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-colors disabled:opacity-50"
                            />
                          </div>

                          {/* Confirm Password */}
                          <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-neutral-700 uppercase tracking-wider">Confirm Password</label>
                            <input
                              type="password"
                              required
                              disabled={isSubmitting || !isFirebaseConfigured}
                              placeholder="••••••••"
                              value={confirmPassword}
                              onChange={(e) => setConfirmPassword(e.target.value)}
                              className="w-full px-3.5 py-2.5 text-sm bg-white border border-neutral-200 rounded-lg text-neutral-900 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-colors disabled:opacity-50"
                            />
                          </div>

                          <button
                            type="submit"
                            disabled={isSubmitting || !isFirebaseConfigured}
                            className="w-full h-11 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg transition-colors mt-6 shadow-md shadow-purple-500/10 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                          >
                            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                            {isSubmitting ? "Creating Account..." : "Create Account"}
                          </button>

                          <p className="text-sm text-neutral-500 text-center mt-6 pt-2 border-t border-neutral-100">
                            Already have an account?{" "}
                            <button
                              type="button"
                              disabled={isSubmitting}
                              onClick={() => setStudentMode("signin")}
                              className="font-semibold text-purple-600 hover:text-purple-700 transition-colors cursor-pointer disabled:opacity-50"
                            >
                              Sign in
                            </button>
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </form>
          </div>
        </div>
      </div>
    </>
  )
}
