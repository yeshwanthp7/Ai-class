"use client"

import { useState, useEffect, Suspense } from "react"
import Image from "next/image"
import Link from "next/link"
import {
  LayoutDashboard,
  Video,
  BarChart3,
  Users,
  Settings as SettingsIcon,
  LogOut,
  Calendar,
  Clock,
  GraduationCap,
  BookOpen,
  ArrowRight,
  Plus,
  TrendingUp,
  Search,
  Menu,
  X,
  Copy,
  Check,
  Sliders,
  Shield,
  Volume2,
  Database,
  AlertCircle,
  Activity,
  Award,
  Sparkles,
  ChevronRight,
  Users2,
  Info
} from "lucide-react"
import { subscribeToAuthChanges, User } from "@/lib/auth-service"
import { getTeacherSessions, getTeacherStudentsRoster, RosterStudent } from "@/lib/session-service"
import { useRouter, useSearchParams } from "next/navigation"
import DashboardSidebar from "@/components/dashboard-sidebar"
import { collection, getDocs } from "firebase/firestore"
import { db } from "@/lib/firebase"
import AIStudyBuddy from "@/components/AIStudyBuddy"

function DashboardContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const currentTab = searchParams.get("tab") || "dashboard"

  const [user, setUser] = useState<User | null>(null)
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false)
  const [currentDate, setCurrentDate] = useState("June 23, 2026")
  
  const [sessions, setSessions] = useState<any[]>([])
  const [loadingSessions, setLoadingSessions] = useState(true)

  const [roster, setRoster] = useState<RosterStudent[]>([])
  const [loadingRoster, setLoadingRoster] = useState(false)
  const [studentSearchQuery, setStudentSearchQuery] = useState("")

  const [copiedCode, setCopiedCode] = useState<string | null>(null)
  
  // My Sessions Filtering State
  const [sessionsSearch, setSessionsSearch] = useState("")
  const [sessionsFilter, setSessionsFilter] = useState("All")

  // Settings States
  const [settings, setSettings] = useState({
    faceWarningThreshold: 5,
    outOfFrameTimeout: 5,
    defaultFocusMode: false,
    defaultAllowLateJoins: true,
    aiLecturerVoice: "Google US English (en-US)",
    autoExportRoster: false,
    emailNotifications: true
  })
  const [saveSuccess, setSaveSuccess] = useState(false)

  // Real-time Firestore Aggregated Analytics States
  const [sessionFocusScores, setSessionFocusScores] = useState<Record<string, number>>({})
  const [loadingFocusScores, setLoadingFocusScores] = useState(false)

  const [focusDistribution, setFocusDistribution] = useState({ active: 0, idle: 0, distracted: 0 })
  const [loadingDistribution, setLoadingDistribution] = useState(false)

  const [kickedLogs, setKickedLogs] = useState<Array<{ name: string; sessionCode: string; kickedAt: any }>>([])
  const [loadingKickedLogs, setLoadingKickedLogs] = useState(false)

  // Load current auth state
  useEffect(() => {
    const unsubscribe = subscribeToAuthChanges((currentUser) => {
      setUser(currentUser)
    })
    return () => unsubscribe()
  }, [])

  // Fetch real sessions from Firestore when teacher loads
  useEffect(() => {
    if (!user) return
    const fetchSessions = async () => {
      setLoadingSessions(true)
      const list = await getTeacherSessions(user.uid)
      setSessions(list)
      setLoadingSessions(false)
    }
    fetchSessions()
  }, [user])

  // Compile student roster when sessions are loaded
  useEffect(() => {
    if (!user || sessions.length === 0) return
    const fetchRoster = async () => {
      setLoadingRoster(true)
      const sessionCodes = sessions.map(s => s.code)
      const list = await getTeacherStudentsRoster(sessionCodes)
      setRoster(list)
      setLoadingRoster(false)
    }
    fetchRoster()
  }, [sessions, user])

  // Fetch detailed session metrics (focus scores, distribution, kicks) from Firestore
  useEffect(() => {
    if (!user || sessions.length === 0) return

    const fetchDetailedMetrics = async () => {
      setLoadingFocusScores(true)
      setLoadingDistribution(true)
      setLoadingKickedLogs(true)

      const scores: Record<string, number> = {}
      let activeCount = 0
      let idleCount = 0
      let distractedCount = 0
      const logs: Array<{ name: string; sessionCode: string; kickedAt: any }> = []

      await Promise.all(
        sessions.map(async (sess) => {
          try {
            // 1. Fetch students for focus score and distribution
            const studentsCol = collection(db, "sessions", sess.code, "students")
            const studentsSnap = await getDocs(studentsCol)
            
            if (studentsSnap.empty) {
              scores[sess.code] = 0
            } else {
              let totalScore = 0
              studentsSnap.forEach((doc) => {
                const data = doc.data()
                totalScore += data.engagementScore || 0
                
                // Count status for distribution
                const status = data.status
                if (status === "active") activeCount++
                else if (status === "idle") idleCount++
                else if (status === "distracted") distractedCount++
              })
              scores[sess.code] = Math.round(totalScore / studentsSnap.size)
            }

            // 2. Fetch kicked list for disciplinary logs
            const kickedCol = collection(db, "sessions", sess.code, "kicked")
            const kickedSnap = await getDocs(kickedCol)
            kickedSnap.forEach((doc) => {
              const data = doc.data()
              logs.push({
                name: data.name || "Unknown Student",
                sessionCode: sess.code,
                kickedAt: data.kickedAt || null
              })
            })
          } catch (err) {
            console.error("Error fetching subcollections for session:", sess.code, err)
          }
        })
      )

      // Update states
      setSessionFocusScores(scores)
      setLoadingFocusScores(false)

      const totalStatus = activeCount + idleCount + distractedCount
      if (totalStatus > 0) {
        setFocusDistribution({
          active: Math.round((activeCount / totalStatus) * 100),
          idle: Math.round((idleCount / totalStatus) * 100),
          distracted: Math.round((distractedCount / totalStatus) * 100)
        })
      } else {
        setFocusDistribution({ active: 0, idle: 0, distracted: 0 })
      }
      setLoadingDistribution(false)

      // Sort kicked logs by timestamp desc
      logs.sort((a, b) => {
        const aTime = a.kickedAt?.seconds ? a.kickedAt.seconds * 1000 : 0
        const bTime = b.kickedAt?.seconds ? b.kickedAt.seconds * 1000 : 0
        return bTime - aTime
      })
      setKickedLogs(logs)
      setLoadingKickedLogs(false)
    }

    fetchDetailedMetrics()
  }, [sessions, user])

  // Format date dynamically on client side to avoid hydration mismatch
  useEffect(() => {
    const options: Intl.DateTimeFormatOptions = {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    }
    setCurrentDate(new Date().toLocaleDateString("en-US", options))
  }, [])

  const copyToClipboard = (code: string) => {
    navigator.clipboard.writeText(code)
    setCopiedCode(code)
    setTimeout(() => setCopiedCode(null), 2000)
  }

  const teacherName = user?.displayName || "Dr. Sarah Jenkins"

  const formatSessionDate = (sess: any) => {
    if (sess.date) return sess.date
    if (!sess.createdAt) return "Just now"
    const d = sess.createdAt.seconds ? new Date(sess.createdAt.seconds * 1000) : new Date(sess.createdAt)
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
  }

  const handleSessionClick = (code: string, status: string) => {
    if (status === "Completed") {
      router.push(`/session/${code}/summary`)
    } else {
      router.push(`/session/${code}`)
    }
  }

  // Derive activeItem label for sidebar highlighting
  let activeItem = "Dashboard"
  if (currentTab === "sessions") activeItem = "My Sessions"
  else if (currentTab === "analytics") activeItem = "Analytics"
  else if (currentTab === "students") activeItem = "Students"
  else if (currentTab === "settings") activeItem = "Settings"
  else if (currentTab === "study-buddy") activeItem = "AI Study Buddy"

  // Helper to parse duration strings safely
  const parseDuration = (dur: string) => {
    if (!dur) return 0
    const num = parseFloat(dur)
    if (isNaN(num)) return 0
    if (num > 10) return num / 60 // If duration is in minutes (e.g. 45 or 60), convert to hours
    return num
  }

  // ─── Real Database Metrics Aggregations ───
  const totalSessionsCount = sessions.length
  const studentsTaughtCount = sessions.reduce((acc, s) => acc + (s.studentCount || 0), 0)
  const teachingHours = sessions.reduce((acc, s) => acc + parseDuration(s.duration), 0).toFixed(1)
  const avgEngagementRate = roster.length > 0 
    ? Math.round(roster.reduce((acc, s) => acc + s.avgEngagement, 0) / roster.length) 
    : 0

  // AI assistant tool statistics gathered from real session parameters
  const aiLecturesCount = sessions.filter(s => s.teachingMode === "AI").length
  const doubtChatCount = sessions.filter(s => s.aiAssistants?.doubtChat).length
  const visualsCount = sessions.filter(s => s.aiAssistants?.generateVisuals).length
  const notesCount = sessions.filter(s => s.aiAssistants?.sessionNotes).length

  // Filter scheduled sessions
  const upcomingSessionsList = sessions.filter(s => s.status === "Scheduled")

  return (
    <div className="min-h-screen bg-[#111111] text-white flex font-sans antialiased">
      <DashboardSidebar
        activeItem={activeItem}
        isMobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
      />

      {/* ─── Main Content Area ─── */}
      <div className="flex-1 lg:ml-64 flex flex-col">
        
        {/* Header Topbar */}
        <header className="h-16 border-b border-[#1a1a1a] bg-[#111111]/80 backdrop-blur-xl px-6 md:px-8 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-3">
            {/* Hamburger menu for mobile view */}
            <button
              onClick={() => setIsMobileSidebarOpen(true)}
              className="p-1.5 rounded-lg border border-white/10 hover:bg-white/5 lg:hidden text-white/80 hover:text-white"
            >
              <Menu className="h-5 w-5" />
            </button>
            
            <h1 className="text-base md:text-lg font-bold text-white tracking-tight">
              Good morning, <span className="bg-gradient-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent">{teacherName}</span>
            </h1>
          </div>

          <div className="flex items-center gap-4">
            <span className="hidden sm:inline-flex text-xs font-semibold text-white/50 bg-[#1a1a1a] px-3.5 py-1.5 rounded-lg border border-white/5">
              {currentDate}
            </span>
            <Link href="/dashboard/create-session" className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-violet-600 px-4 py-2 text-xs font-bold text-white shadow-sm shadow-purple-500/20 hover:brightness-110 cursor-pointer">
              <Plus className="h-3.5 w-3.5" />
              New Session
            </Link>
          </div>
        </header>

        {/* Dashboard Grid Content */}
        <main className="flex-1 p-6 md:p-8 space-y-8 max-w-6xl w-full mx-auto">
          
          {/* ────────────────── TABS RENDERING ────────────────── */}

          {/* 1. DEFAULT DASHBOARD TAB */}
          {currentTab === "dashboard" && (
            <div className="space-y-8 animate-fadeIn">
              {/* Stats Row */}
              <section className="grid gap-4 grid-cols-2 lg:grid-cols-4">
                {/* Card 1: Total Sessions */}
                <div className="bg-[#1a1a1a] rounded-xl border border-white/5 border-l-4 border-l-purple-500 p-5 shadow-sm">
                  <div className="flex items-center justify-between text-white/40 mb-3">
                    <span className="text-xs font-bold uppercase tracking-wider">Total Sessions</span>
                    <div className="h-8 w-8 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-400">
                      <Video className="h-4 w-4" />
                    </div>
                  </div>
                  <h3 className="text-2xl font-bold text-white">{loadingSessions ? "..." : totalSessionsCount}</h3>
                  <span className="text-[10px] text-white/30 font-medium">All active & finished</span>
                </div>

                {/* Card 2: Students Taught */}
                <div className="bg-[#1a1a1a] rounded-xl border border-white/5 border-l-4 border-l-purple-500 p-5 shadow-sm">
                  <div className="flex items-center justify-between text-white/40 mb-3">
                    <span className="text-xs font-bold uppercase tracking-wider">Students Taught</span>
                    <div className="h-8 w-8 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-400">
                      <GraduationCap className="h-4 w-4" />
                    </div>
                  </div>
                  <h3 className="text-2xl font-bold text-white">{loadingSessions ? "..." : studentsTaughtCount}</h3>
                  <span className="text-[10px] text-emerald-400 font-medium">From database registers</span>
                </div>

                {/* Card 3: Hours of Teaching */}
                <div className="bg-[#1a1a1a] rounded-xl border border-white/5 border-l-4 border-l-purple-500 p-5 shadow-sm">
                  <div className="flex items-center justify-between text-white/40 mb-3">
                    <span className="text-xs font-bold uppercase tracking-wider">Hours of Teaching</span>
                    <div className="h-8 w-8 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-400">
                      <Clock className="h-4 w-4" />
                    </div>
                  </div>
                  <h3 className="text-2xl font-bold text-white">{loadingSessions ? "..." : teachingHours}h</h3>
                  <span className="text-[10px] text-white/30 font-medium">Total live duration</span>
                </div>

                {/* Card 4: Avg Engagement */}
                <div className="bg-[#1a1a1a] rounded-xl border border-white/5 border-l-4 border-l-purple-500 p-5 shadow-sm">
                  <div className="flex items-center justify-between text-white/40 mb-3">
                    <span className="text-xs font-bold uppercase tracking-wider">Avg Engagement</span>
                    <div className="h-8 w-8 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-400">
                      <BarChart3 className="h-4 w-4" />
                    </div>
                  </div>
                  <h3 className="text-2xl font-bold text-white">{loadingRoster ? "..." : `${avgEngagementRate}%`}</h3>
                  <span className="text-[10px] text-emerald-400 font-medium">Average across students</span>
                </div>
              </section>

              {/* Columns Split */}
              <div className="grid gap-8 lg:grid-cols-3">
                {/* Left Column (Quick Start & Recent) */}
                <div className="lg:col-span-2 space-y-6">
                  {/* Quick Start Card */}
                  <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-purple-600 via-violet-600 to-indigo-600 p-6 shadow-lg shadow-purple-500/15">
                    <div className="absolute right-0 top-0 h-full w-1/3 bg-white/5 rounded-l-full translate-x-12 scale-110 pointer-events-none" />
                    <div className="relative z-10 space-y-4">
                      <div>
                        <h2 className="text-xl font-bold text-white">Start a New Session</h2>
                        <p className="text-xs text-purple-100 mt-1">Your AI teacher is ready to go live</p>
                      </div>
                      <Link href="/dashboard/create-session" className="inline-flex items-center gap-1.5 rounded-xl bg-white px-5 py-2.5 text-xs font-bold text-purple-700 shadow-md transition-all hover:bg-neutral-50 hover:shadow-lg cursor-pointer">
                        Create Session
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </div>

                  {/* Recent Sessions */}
                  <div className="bg-[#1a1a1a] rounded-xl border border-white/5 overflow-hidden">
                    <div className="px-6 py-5 border-b border-white/5 flex items-center justify-between">
                      <h3 className="text-sm font-bold uppercase tracking-wider text-white">Recent Sessions</h3>
                      <Link href="/dashboard?tab=sessions" className="text-xs text-purple-400 font-semibold hover:text-purple-300">
                        View All
                      </Link>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-[#242424] text-[10px] font-bold uppercase tracking-wider text-white/40 bg-black/10">
                            <th className="px-6 py-3.5">Session Name</th>
                            <th className="px-4 py-3.5">Topics</th>
                            <th className="px-4 py-3.5">Students</th>
                            <th className="px-4 py-3.5">Date</th>
                            <th className="px-6 py-3.5 text-right">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#242424]">
                          {loadingSessions ? (
                            <tr>
                              <td colSpan={5} className="px-6 py-8 text-center text-white/40 text-xs font-semibold">
                                <div className="h-5 w-5 rounded-full border border-purple-500 border-t-transparent animate-spin mx-auto mb-2" />
                                Loading your sessions...
                              </td>
                            </tr>
                          ) : sessions.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="px-6 py-12 text-center text-white/40 text-xs font-medium">
                                <Info className="h-6 w-6 text-white/20 mx-auto mb-2" />
                                No sessions created yet. Click "New Session" above to start your first class.
                              </td>
                            </tr>
                          ) : (
                            sessions.slice(0, 5).map((session, index) => {
                              const sCode = session.code
                              const topicsCount = session.topics?.length ?? 0
                              const studentCount = session.studentCount ?? 0
                              const title = session.title || session.name

                              return (
                                <tr
                                  key={index}
                                  onClick={() => handleSessionClick(sCode, session.status)}
                                  className="text-xs hover:bg-white/[0.03] transition-colors cursor-pointer"
                                >
                                  <td className="px-6 py-4 font-semibold text-white/95 max-w-[180px] truncate">
                                    {title}
                                    <span className="block text-[10px] text-white/40 font-mono mt-0.5">{sCode}</span>
                                  </td>
                                  <td className="px-4 py-4 text-white/60">
                                    <span className="inline-flex items-center gap-1">
                                      <BookOpen className="h-3.5 w-3.5 text-purple-400/70" />
                                      {topicsCount}
                                    </span>
                                  </td>
                                  <td className="px-4 py-4 text-white/60">
                                    <span className="inline-flex items-center gap-1">
                                      <Users className="h-3.5 w-3.5 text-purple-400/70" />
                                      {studentCount}
                                    </span>
                                  </td>
                                  <td className="px-4 py-4 text-white/50">{formatSessionDate(session)}</td>
                                  <td className="px-6 py-4 text-right">
                                    {(session.status === "Live" || session.status === "Active") && (
                                      <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/10 border border-red-500/20 px-2.5 py-1 text-[10px] font-bold text-red-400 uppercase tracking-wider">
                                        <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
                                        Live
                                      </span>
                                    )}
                                    {session.status === "Completed" && (
                                      <span className="inline-flex items-center rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                                        Completed
                                      </span>
                                    )}
                                    {session.status === "Scheduled" && (
                                      <span className="inline-flex items-center rounded-full bg-blue-500/10 border border-blue-500/20 px-2.5 py-1 text-[10px] font-bold text-blue-400 uppercase tracking-wider">
                                        Scheduled
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              )
                            })
                          )}
                        </tbody>
                      </table>
                    </div>

                    {sessions.length > 5 && (
                      <div className="px-6 py-4 border-t border-white/5 bg-black/5 text-center">
                        <Link href="/dashboard?tab=sessions" className="text-xs font-semibold text-purple-400 hover:text-purple-300 transition-colors inline-flex items-center gap-1">
                          View All Sessions
                          <ArrowRight className="h-3 w-3" />
                        </Link>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Column (Upcoming Sessions) */}
                <div className="space-y-6">
                  <div className="bg-[#1a1a1a] rounded-xl border border-white/5 p-5 space-y-4">
                    <div className="border-b border-white/5 pb-3">
                      <h3 className="text-sm font-bold uppercase tracking-wider text-white">Upcoming Sessions</h3>
                    </div>

                    <div className="space-y-3.5">
                      {loadingSessions ? (
                        <div className="py-8 text-center text-white/30 text-xs">Loading scheduled...</div>
                      ) : upcomingSessionsList.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-white/5 p-6 text-center text-white/40 text-xs">
                          No upcoming sessions scheduled.
                        </div>
                      ) : (
                        upcomingSessionsList.map((session, index) => {
                          const d = session.scheduledAt?.seconds ? new Date(session.scheduledAt.seconds * 1000) : (session.scheduledAt ? new Date(session.scheduledAt) : new Date())
                          const dateString = d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
                          const timeString = d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
                          return (
                            <div
                              key={index}
                              className="group rounded-xl border border-white/5 bg-white/[0.01] p-4 space-y-3 transition-colors hover:border-purple-500/20 hover:bg-white/[0.02]"
                            >
                              <h4 className="text-xs font-bold text-white group-hover:text-purple-400 transition-colors">
                                {session.title || session.name}
                              </h4>
                              <div className="flex items-center justify-between text-[11px] text-white/50">
                                <span className="flex items-center gap-1.5">
                                  <Calendar className="h-3.5 w-3.5 text-purple-500/60" />
                                  {dateString}, {timeString}
                                </span>
                                <span className="font-mono text-purple-400 font-bold bg-purple-500/10 px-1.5 py-0.5 rounded border border-purple-500/10">
                                  {session.code}
                                </span>
                              </div>
                            </div>
                          )
                        })
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* AI STUDY BUDDY TAB */}
          {currentTab === "study-buddy" && (
            <div className="space-y-6 animate-fadeIn">
              <AIStudyBuddy isTeacher={true} />
            </div>
          )}

          {/* 2. MY SESSIONS TAB */}
          {currentTab === "sessions" && (
            <div className="space-y-6 animate-fadeIn">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-white">My Sessions</h2>
                  <p className="text-xs text-white/40 mt-1">Search, copy session codes, or view summary reports</p>
                </div>
                
                <div className="flex flex-col sm:flex-row gap-3">
                  {/* Search Bar */}
                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-white/40" />
                    <input
                      type="text"
                      placeholder="Search sessions..."
                      value={sessionsSearch}
                      onChange={(e) => setSessionsSearch(e.target.value)}
                      className="bg-[#1a1a1a] rounded-xl border border-white/5 pl-9 pr-4 py-2 text-xs text-white focus:outline-none focus:border-purple-500 w-full sm:w-60 transition-colors"
                    />
                  </div>

                  {/* Filter Dropdown */}
                  <select
                    value={sessionsFilter}
                    onChange={(e) => setSessionsFilter(e.target.value)}
                    className="bg-[#1a1a1a] rounded-xl border border-white/5 px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500 transition-colors"
                  >
                    <option value="All">All Statuses</option>
                    <option value="Live">Live / Active</option>
                    <option value="Completed">Completed</option>
                    <option value="Scheduled">Scheduled</option>
                  </select>
                </div>
              </div>

              {/* Sessions List */}
              <div className="bg-[#1a1a1a] rounded-xl border border-white/5 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-[#242424] text-[10px] font-bold uppercase tracking-wider text-white/40 bg-black/10">
                        <th className="px-6 py-4">Session Name & Code</th>
                        <th className="px-4 py-4">Subject & Grade</th>
                        <th className="px-4 py-4">Topics</th>
                        <th className="px-4 py-4">Students</th>
                        <th className="px-4 py-4">Created Date</th>
                        <th className="px-4 py-4">Status</th>
                        <th className="px-6 py-4 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#242424]">
                      {loadingSessions ? (
                        <tr>
                          <td colSpan={7} className="px-6 py-12 text-center text-white/40 text-xs font-semibold">
                            <div className="h-6 w-6 rounded-full border-2 border-purple-500 border-t-transparent animate-spin mx-auto mb-3" />
                            Loading class list...
                          </td>
                        </tr>
                      ) : (
                        sessions
                          .filter(session => {
                            const title = (session.title || session.name || "").toLowerCase()
                            const code = (session.code || "").toLowerCase()
                            const matchesSearch = title.includes(sessionsSearch.toLowerCase()) || code.includes(sessionsSearch.toLowerCase())
                            
                            if (sessionsFilter === "All") return matchesSearch
                            if (sessionsFilter === "Live") return matchesSearch && (session.status === "Live" || session.status === "Active")
                            if (sessionsFilter === "Completed") return matchesSearch && session.status === "Completed"
                            if (sessionsFilter === "Scheduled") return matchesSearch && session.status === "Scheduled"
                            return matchesSearch
                          })
                          .map((session, index) => {
                            const sCode = session.code
                            const topicsCount = session.topics?.length ?? 0
                            const studentCount = session.studentCount ?? 0
                            const title = session.title || session.name
                            const isLive = session.status === "Live" || session.status === "Active"

                            return (
                              <tr key={index} className="text-xs hover:bg-white/[0.02] transition-colors">
                                <td className="px-6 py-4 font-semibold text-white/95">
                                  <div>{title}</div>
                                  <div className="flex items-center gap-1.5 mt-1">
                                    <span className="font-mono text-[10px] text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">{sCode}</span>
                                    <button
                                      onClick={() => copyToClipboard(sCode)}
                                      className="p-1 rounded hover:bg-white/5 text-white/40 hover:text-white transition-colors"
                                      title="Copy Session Code"
                                    >
                                      {copiedCode === sCode ? (
                                        <Check className="h-3 w-3 text-emerald-400" />
                                      ) : (
                                        <Copy className="h-3 w-3" />
                                      )}
                                    </button>
                                  </div>
                                </td>
                                <td className="px-4 py-4 text-white/60">
                                  <div className="font-medium text-white/80">{session.subject || "General"}</div>
                                  <div className="text-[10px] text-white/40">{session.gradeLevel || "Grade 10"}</div>
                                </td>
                                <td className="px-4 py-4 text-white/60">
                                  <span className="inline-flex items-center gap-1">
                                    <BookOpen className="h-3.5 w-3.5 text-purple-400/70" />
                                    {topicsCount} topics
                                  </span>
                                </td>
                                <td className="px-4 py-4 text-white/60">
                                  <span className="inline-flex items-center gap-1">
                                    <Users className="h-3.5 w-3.5 text-purple-400/70" />
                                    {studentCount} joined
                                  </span>
                                </td>
                                <td className="px-4 py-4 text-white/50">{formatSessionDate(session)}</td>
                                <td className="px-4 py-4">
                                  {isLive && (
                                    <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/10 border border-red-500/20 px-2.5 py-1 text-[10px] font-bold text-red-400 uppercase tracking-wider">
                                      <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
                                      Live
                                    </span>
                                  )}
                                  {session.status === "Completed" && (
                                    <span className="inline-flex items-center rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                                      Completed
                                    </span>
                                  )}
                                  {session.status === "Scheduled" && (
                                    <span className="inline-flex items-center rounded-full bg-blue-500/10 border border-blue-500/20 px-2.5 py-1 text-[10px] font-bold text-blue-400 uppercase tracking-wider">
                                      Scheduled
                                    </span>
                                  )}
                                </td>
                                <td className="px-6 py-4 text-right">
                                  {session.status === "Completed" ? (
                                    <Link
                                      href={`/session/${sCode}/summary`}
                                      className="inline-flex items-center gap-1 bg-[#242424] hover:bg-[#2d2d2d] text-white font-bold px-3 py-1.5 rounded-lg border border-white/5 transition-all text-[11px]"
                                    >
                                      View Summary
                                      <ChevronRight className="h-3.5 w-3.5" />
                                    </Link>
                                  ) : (
                                    <Link
                                      href={`/session/${sCode}`}
                                      className="inline-flex items-center gap-1 bg-gradient-to-r from-purple-600 to-indigo-600 hover:brightness-110 text-white font-bold px-3 py-1.5 rounded-lg transition-all text-[11px] shadow-sm shadow-purple-500/10"
                                    >
                                      Open Lobby
                                      <ChevronRight className="h-3.5 w-3.5" />
                                    </Link>
                                  )}
                                </td>
                              </tr>
                            )
                          })
                      )}
                      {!loadingSessions && sessions.length === 0 && (
                        <tr>
                          <td colSpan={7} className="px-6 py-12 text-center text-white/40 text-xs">
                            No sessions found. Create a new session to begin.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* 3. ANALYTICS TAB */}
          {currentTab === "analytics" && (
            <div className="space-y-8 animate-fadeIn">
              <div>
                <h2 className="text-xl font-bold text-white">Classroom Performance Analytics</h2>
                <p className="text-xs text-white/40 mt-1">Focus fluctuations, status indicators, and assistant configurations</p>
              </div>

              {/* Primary Chart mockup / Visual panels */}
              <div className="grid gap-6 md:grid-cols-3">
                <div className="md:col-span-2 bg-[#1a1a1a] rounded-xl border border-white/5 p-6 space-y-6">
                  <div className="flex items-center justify-between border-b border-white/5 pb-4">
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                      <Activity className="h-4 w-4 text-purple-400" />
                      Session Average Attention Levels
                    </h3>
                    <span className="text-xs text-white/40">Real Completed Classes</span>
                  </div>

                  <div className="space-y-4">
                    {loadingFocusScores ? (
                      <div className="py-12 text-center text-white/30 text-xs">Calculating focus history...</div>
                    ) : sessions.filter(s => s.status === "Completed").length === 0 ? (
                      <div className="py-12 text-center text-white/40 text-xs leading-relaxed">
                        <Info className="h-6 w-6 text-white/20 mx-auto mb-2" />
                        No focus data available. Complete a session with students to see trends.
                      </div>
                    ) : (
                      sessions
                        .filter(s => s.status === "Completed")
                        .slice(0, 5)
                        .map((sess, i) => {
                          const focusVal = sessionFocusScores[sess.code] || 0
                          return (
                            <div key={i} className="space-y-1.5">
                              <div className="flex justify-between text-xs">
                                <span className="font-semibold text-white/95">
                                  {sess.title || sess.name}{" "}
                                  <span className="text-[10px] text-white/40 font-mono">({sess.code})</span>
                                </span>
                                <span className="font-bold text-purple-400">{focusVal > 0 ? `${focusVal}% Avg` : "0% Focus"}</span>
                              </div>
                              <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full transition-all duration-1000"
                                  style={{ width: `${focusVal}%` }}
                                />
                              </div>
                            </div>
                          )
                        })
                    )}
                  </div>
                </div>

                {/* Right Panel: Focus Distribution */}
                <div className="bg-[#1a1a1a] rounded-xl border border-white/5 p-6 flex flex-col justify-between">
                  <div className="border-b border-white/5 pb-3">
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-emerald-400" />
                      Active Focus Distribution
                    </h3>
                  </div>

                  <div className="py-6 space-y-5">
                    {loadingDistribution ? (
                      <div className="text-center text-white/30 text-xs py-8">Analyzing student states...</div>
                    ) : (focusDistribution.active === 0 && focusDistribution.idle === 0 && focusDistribution.distracted === 0) ? (
                      <div className="text-center text-white/40 text-xs py-8">
                        No active student data.
                      </div>
                    ) : (
                      <>
                        {/* Active */}
                        <div className="space-y-1.5">
                          <div className="flex justify-between text-xs">
                            <span className="text-white/60 font-semibold">Active & Focused</span>
                            <span className="font-bold text-emerald-400">{focusDistribution.active}%</span>
                          </div>
                          <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${focusDistribution.active}%` }} />
                          </div>
                        </div>

                        {/* Idle */}
                        <div className="space-y-1.5">
                          <div className="flex justify-between text-xs">
                            <span className="text-white/60 font-semibold">Idle / Drowsy</span>
                            <span className="font-bold text-amber-400">{focusDistribution.idle}%</span>
                          </div>
                          <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                            <div className="h-full bg-amber-500 rounded-full" style={{ width: `${focusDistribution.idle}%` }} />
                          </div>
                        </div>

                        {/* Distracted */}
                        <div className="space-y-1.5">
                          <div className="flex justify-between text-xs">
                            <span className="text-white/60 font-semibold">Distracted / Left Frame</span>
                            <span className="font-bold text-red-400">{focusDistribution.distracted}%</span>
                          </div>
                          <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                            <div className="h-full bg-red-500 rounded-full" style={{ width: `${focusDistribution.distracted}%` }} />
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                  <div className="bg-black/10 rounded-lg p-3 text-[10px] text-white/50 leading-relaxed border border-white/5">
                    💡 **AI recommendation:** Active focus levels represent live student presence. Regularly trigger doubt check-in breaks to improve attention spans.
                  </div>
                </div>
              </div>

              {/* Bottom statistics grid */}
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {/* AI Performance Card */}
                <div className="bg-[#1a1a1a] rounded-xl border border-white/5 p-5 space-y-4">
                  <div className="flex items-center gap-2 text-purple-400 font-bold text-xs uppercase tracking-wider">
                    <Sparkles className="h-4 w-4" />
                    AI Assistant Configurations
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-2xl font-bold text-white">{loadingSessions ? "..." : aiLecturesCount}</div>
                      <div className="text-[10px] text-white/40 mt-0.5">AI Lectures created</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-white">{loadingSessions ? "..." : doubtChatCount}</div>
                      <div className="text-[10px] text-white/40 mt-0.5">Doubt chats enabled</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-white">{loadingSessions ? "..." : visualsCount}</div>
                      <div className="text-[10px] text-white/40 mt-0.5">Visual builders active</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-white">{loadingSessions ? "..." : notesCount}</div>
                      <div className="text-[10px] text-white/40 mt-0.5">Auto notes generated</div>
                    </div>
                  </div>
                </div>

                {/* Engagement Leaderboard */}
                <div className="bg-[#1a1a1a] rounded-xl border border-white/5 p-5 space-y-4">
                  <div className="flex items-center gap-2 text-purple-400 font-bold text-xs uppercase tracking-wider">
                    <Award className="h-4 w-4" />
                    Top Performing Students
                  </div>
                  <div className="space-y-2.5">
                    {loadingRoster ? (
                      <div className="text-center text-white/30 text-xs py-4">Loading leaderboard...</div>
                    ) : roster.length === 0 ? (
                      <div className="text-center text-white/40 text-xs py-4">No student records found.</div>
                    ) : (
                      roster
                        .slice()
                        .sort((a, b) => b.avgEngagement - a.avgEngagement)
                        .slice(0, 3)
                        .map((student, i) => (
                          <div key={i} className="flex items-center justify-between text-xs border-b border-white/[0.03] pb-2 last:border-0 last:pb-0">
                            <span className="font-semibold text-white/80">{student.name}</span>
                            <span className="font-bold text-emerald-400">{student.avgEngagement}% Focus</span>
                          </div>
                        ))
                    )}
                  </div>
                </div>

                {/* Classroom alert logs */}
                <div className="bg-[#1a1a1a] rounded-xl border border-white/5 p-5 space-y-4 sm:col-span-2 lg:col-span-1">
                  <div className="flex items-center gap-2 text-purple-400 font-bold text-xs uppercase tracking-wider">
                    <AlertCircle className="h-4 w-4" />
                    Disciplinary / Kicked Log
                  </div>
                  <div className="space-y-2.5 text-xs text-white/60 max-h-32 overflow-y-auto pr-1">
                    {loadingKickedLogs ? (
                      <div className="text-center text-white/30 text-xs py-4">Loading kicks...</div>
                    ) : kickedLogs.length === 0 ? (
                      <div className="text-center text-white/40 text-xs py-4">No disciplinary actions recorded.</div>
                    ) : (
                      kickedLogs.map((log, i) => {
                        const d = log.kickedAt?.seconds ? new Date(log.kickedAt.seconds * 1000) : (log.kickedAt ? new Date(log.kickedAt) : null)
                        const dStr = d ? d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "Recently"
                        return (
                          <div key={i} className="flex items-start gap-2 border-b border-white/[0.03] pb-2 last:border-0 last:pb-0">
                            <span className="h-2 w-2 rounded-full bg-red-500 mt-1.5 flex-shrink-0" />
                            <div>
                              <div className="font-semibold text-white/80">{log.name}</div>
                              <div className="text-[10px] text-white/40 mt-0.5">Kicked from {log.sessionCode} • {dStr}</div>
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 4. STUDENTS TAB */}
          {currentTab === "students" && (
            <div className="space-y-6 animate-fadeIn">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-white">Student Directory</h2>
                  <p className="text-xs text-white/40 mt-1">Overview of students roster and engagement parameters across all classes</p>
                </div>

                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-white/40" />
                  <input
                    type="text"
                    placeholder="Search roster..."
                    value={studentSearchQuery}
                    onChange={(e) => setStudentSearchQuery(e.target.value)}
                    className="bg-[#1a1a1a] rounded-xl border border-white/5 pl-9 pr-4 py-2 text-xs text-white focus:outline-none focus:border-purple-500 w-full sm:w-64 transition-colors"
                  />
                </div>
              </div>

              {/* Roster Table */}
              <div className="bg-[#1a1a1a] rounded-xl border border-white/5 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-[#242424] text-[10px] font-bold uppercase tracking-wider text-white/40 bg-black/10">
                        <th className="px-6 py-4">Student Name</th>
                        <th className="px-6 py-4">Classes Attended</th>
                        <th className="px-6 py-4">Average Focus Score</th>
                        <th className="px-6 py-4">Status Indicator</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#242424]">
                      {loadingRoster ? (
                        <tr>
                          <td colSpan={4} className="px-6 py-12 text-center text-white/40 text-xs font-semibold">
                            <div className="h-6 w-6 rounded-full border-2 border-purple-500 border-t-transparent animate-spin mx-auto mb-3" />
                            Compiling database roster...
                          </td>
                        </tr>
                      ) : roster.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-6 py-12 text-center text-white/40 text-xs">
                            <Users2 className="h-8 w-8 text-white/10 mx-auto mb-2" />
                            No student attendance records found.
                          </td>
                        </tr>
                      ) : (
                        roster
                          .filter(std => std.name.toLowerCase().includes(studentSearchQuery.toLowerCase()))
                          .map((student, index) => {
                            const nameInitial = student.name
                              .split(" ")
                              .map(n => n[0])
                              .join("")
                              .slice(0, 2)
                              .toUpperCase()
                            
                            let ratingColor = "text-emerald-400"
                            if (student.avgEngagement < 90 && student.avgEngagement >= 80) ratingColor = "text-amber-400"
                            if (student.avgEngagement < 80) ratingColor = "text-red-400"

                            return (
                              <tr key={index} className="text-xs hover:bg-white/[0.015] transition-colors">
                                <td className="px-6 py-4 font-semibold text-white/95 flex items-center gap-3">
                                  <div className="h-8 w-8 rounded-full bg-purple-600/10 border border-purple-500/20 flex items-center justify-center text-xs font-bold text-purple-400">
                                    {nameInitial}
                                  </div>
                                  <div>
                                    <div className="font-semibold text-white">{student.name}</div>
                                    <div className="text-[10px] text-white/40 font-mono">ID: {student.name.toLowerCase().replace(/\s+/g, "-")}</div>
                                  </div>
                                </td>
                                <td className="px-6 py-4 text-white/60">
                                  <span className="inline-flex items-center gap-1 text-white bg-[#242424] px-2.5 py-1 rounded-md border border-white/5 font-semibold text-[10px]">
                                    {student.classesAttended} Sessions
                                  </span>
                                </td>
                                <td className="px-6 py-4">
                                  <span className={`font-bold ${ratingColor} text-sm`}>{student.avgEngagement}%</span>
                                </td>
                                <td className="px-6 py-4">
                                  {student.avgEngagement >= 90 ? (
                                    <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded font-bold uppercase tracking-wide">
                                      High Attentive
                                    </span>
                                  ) : student.avgEngagement >= 80 ? (
                                    <span className="inline-flex items-center gap-1 text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded font-bold uppercase tracking-wide">
                                      Normal
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 text-[10px] text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded font-bold uppercase tracking-wide">
                                      Needs Review
                                    </span>
                                  )}
                                </td>
                              </tr>
                            )
                          })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* 5. SETTINGS TAB */}
          {currentTab === "settings" && (
            <div className="space-y-6 animate-fadeIn">
              <div>
                <h2 className="text-xl font-bold text-white">Teacher Preference Settings</h2>
                <p className="text-xs text-white/40 mt-1">Configure default session control rules and check connection integrity</p>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                {/* Left Card: Session rules configuration */}
                <div className="bg-[#1a1a1a] rounded-xl border border-white/5 p-6 space-y-6">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2 border-b border-white/5 pb-3">
                    <Sliders className="h-4 w-4 text-purple-400" />
                    Session Control Default Rules
                  </h3>

                  <div className="space-y-4">
                    {/* Face tracking warning limit */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-white/80">Sustained Distraction Warning Limit</span>
                        <span className="font-mono text-purple-400 font-bold">{settings.faceWarningThreshold} seconds</span>
                      </div>
                      <input
                        type="range"
                        min="3"
                        max="15"
                        value={settings.faceWarningThreshold}
                        onChange={(e) => setSettings({ ...settings, faceWarningThreshold: parseInt(e.target.value) })}
                        className="w-full h-1.5 bg-[#2d2d2d] rounded-lg appearance-none cursor-pointer accent-purple-500"
                      />
                    </div>

                    {/* Out of frame timeout */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-white/80">Out of Frame Kick Countdown</span>
                        <span className="font-mono text-purple-400 font-bold">{settings.outOfFrameTimeout} seconds</span>
                      </div>
                      <input
                        type="range"
                        min="3"
                        max="15"
                        value={settings.outOfFrameTimeout}
                        onChange={(e) => setSettings({ ...settings, outOfFrameTimeout: parseInt(e.target.value) })}
                        className="w-full h-1.5 bg-[#2d2d2d] rounded-lg appearance-none cursor-pointer accent-purple-500"
                      />
                    </div>

                    {/* Focus mode toggle */}
                    <div className="flex items-center justify-between text-xs border-t border-white/[0.03] pt-3">
                      <div>
                        <div className="font-semibold text-white/80">Enable Focus Mode by Default</div>
                        <div className="text-[10px] text-white/40 mt-0.5">Students webcam feeds are invisible to peers</div>
                      </div>
                      <button
                        onClick={() => setSettings({ ...settings, defaultFocusMode: !settings.defaultFocusMode })}
                        className={`h-6 w-11 rounded-full p-0.5 transition-colors duration-200 outline-none ${
                          settings.defaultFocusMode ? "bg-purple-600" : "bg-[#2d2d2d]"
                        }`}
                      >
                        <div
                          className={`h-5 w-5 rounded-full bg-white transition-transform duration-200 ${
                            settings.defaultFocusMode ? "translate-x-5" : "translate-x-0"
                          }`}
                        />
                      </button>
                    </div>

                    {/* Allow late joins toggle */}
                    <div className="flex items-center justify-between text-xs border-t border-white/[0.03] pt-3">
                      <div>
                        <div className="font-semibold text-white/80">Allow Late Joins</div>
                        <div className="text-[10px] text-white/40 mt-0.5">Allow students to enter after classroom starts</div>
                      </div>
                      <button
                        onClick={() => setSettings({ ...settings, defaultAllowLateJoins: !settings.defaultAllowLateJoins })}
                        className={`h-6 w-11 rounded-full p-0.5 transition-colors duration-200 outline-none ${
                          settings.defaultAllowLateJoins ? "bg-purple-600" : "bg-[#2d2d2d]"
                        }`}
                      >
                        <div
                          className={`h-5 w-5 rounded-full bg-white transition-transform duration-200 ${
                            settings.defaultAllowLateJoins ? "translate-x-5" : "translate-x-0"
                          }`}
                        />
                      </button>
                    </div>

                    {/* Voice selector */}
                    <div className="space-y-1.5 border-t border-white/[0.03] pt-3">
                      <label className="text-xs font-semibold text-white/80 flex items-center gap-1">
                        <Volume2 className="h-3.5 w-3.5 text-purple-400" />
                        AI Lecturer Voice (Speech Synthesis)
                      </label>
                      <select
                        value={settings.aiLecturerVoice}
                        onChange={(e) => setSettings({ ...settings, aiLecturerVoice: e.target.value })}
                        className="w-full bg-[#242424] rounded-lg border border-white/5 px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                      >
                        <option>Google US English (en-US)</option>
                        <option>Google UK English Male (en-GB)</option>
                        <option>Google India English Female (en-IN)</option>
                        <option>Microsoft David Desktop (en-US)</option>
                      </select>
                    </div>

                    <div className="pt-4 flex items-center justify-between gap-4">
                      {saveSuccess && (
                        <span className="text-xs text-emerald-400 font-bold flex items-center gap-1 animate-pulse">
                          <Check className="h-3.5 w-3.5" /> Preferences saved!
                        </span>
                      )}
                      <button
                        onClick={() => {
                          setSaveSuccess(true)
                          setTimeout(() => setSaveSuccess(false), 2000)
                        }}
                        className="ml-auto rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:brightness-110 text-white font-bold px-4 py-2 text-xs transition-all cursor-pointer shadow-sm shadow-purple-500/10"
                      >
                        Save Settings
                      </button>
                    </div>
                  </div>
                </div>

                {/* Right Card: Connections checklists */}
                <div className="space-y-6">
                  {/* System connection */}
                  <div className="bg-[#1a1a1a] rounded-xl border border-white/5 p-6 space-y-5">
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2 border-b border-white/5 pb-3">
                      <Database className="h-4 w-4 text-purple-400" />
                      Live Connection Checklist
                    </h3>

                    <div className="space-y-3.5">
                      {/* Firestore check */}
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-white/70">Firestore Database Connection</span>
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] text-emerald-400 font-bold uppercase tracking-wider">
                          Connected
                        </span>
                      </div>

                      {/* Claude check */}
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-white/70">Claude AI Chat & Lecture API</span>
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] text-emerald-400 font-bold uppercase tracking-wider">
                          Configured
                        </span>
                      </div>

                      {/* Web Speech synthesis check */}
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-white/70">Web Speech Synthesis API</span>
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] text-emerald-400 font-bold uppercase tracking-wider">
                          Available
                        </span>
                      </div>

                      {/* MediaPipe CV check */}
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-white/70">MediaPipe Computer Vision SDK</span>
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] text-emerald-400 font-bold uppercase tracking-wider">
                          Compiled
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Security check */}
                  <div className="bg-[#1a1a1a] rounded-xl border border-white/5 p-6 space-y-4">
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2 border-b border-white/5 pb-3">
                      <Shield className="h-4 w-4 text-purple-400" />
                      System Access Profile
                    </h3>
                    <div className="space-y-1.5 text-xs text-white/60">
                      <div>**Security Scope:** teacher-read-write</div>
                      <div>**Verification Mode:** Google Firebase IAM</div>
                      <div>**App Environment:** Production (six.vercel)</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

        </main>
      </div>
    </div>
  )
}

export default function Dashboard() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#111111] flex flex-col items-center justify-center gap-3">
        <div className="h-10 w-10 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" />
        <span className="text-xs text-white/40 font-semibold tracking-wider animate-pulse">Initializing dashboard...</span>
      </div>
    }>
      <DashboardContent />
    </Suspense>
  )
}
