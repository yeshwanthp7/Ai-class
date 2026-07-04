"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import Link from "next/link"
import {
  LayoutDashboard,
  Video,
  BarChart3,
  Users,
  Settings,
  LogOut,
  X,
} from "lucide-react"
import { subscribeToAuthChanges, signOutUser, User } from "@/lib/auth-service"

// Sidebar navigation items
const navItems = [
  { label: "Dashboard", icon: LayoutDashboard, href: "/dashboard" },
  { label: "My Sessions", icon: Video, href: "/dashboard?tab=sessions" },
  { label: "Analytics", icon: BarChart3, href: "/dashboard?tab=analytics" },
  { label: "Students", icon: Users, href: "/dashboard?tab=students" },
  { label: "Settings", icon: Settings, href: "/dashboard?tab=settings" },
]

interface DashboardSidebarProps {
  activeItem: string
  isMobileOpen?: boolean
  onCloseMobile?: () => void
}

export default function DashboardSidebar({
  activeItem,
  isMobileOpen = false,
  onCloseMobile,
}: DashboardSidebarProps) {
  const [user, setUser] = useState<User | null>(null)

  // Load current auth state
  useEffect(() => {
    const unsubscribe = subscribeToAuthChanges((currentUser) => {
      setUser(currentUser)
    })
    return () => unsubscribe()
  }, [])

  const handleSignOut = async () => {
    try {
      await signOutUser()
      window.location.href = "/auth"
    } catch (error) {
      console.error("Sign out failed", error)
    }
  }

  // Get user display details or fallbacks
  const teacherName = user?.displayName || "Dr. Sarah Jenkins"
  const teacherEmail = user?.email || "sarah.j@school.edu"
  const avatarFallback = teacherName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()

  const sidebarContent = (isMobile: boolean = false) => (
    <>
      <div className="space-y-8">
        {/* Logo */}
        <Link
          href="/dashboard"
          className="flex items-center gap-2.5 border-l-2 border-purple-500/40 pl-3 drop-shadow-[0_0_8px_rgba(147,51,234,0.3)] hover:border-purple-500/70 transition-all"
        >
          <Image src="/logo.png" alt="Class AI" width={32} height={32} />
          <span className="text-lg font-bold tracking-tight text-white">
            Class<span className="text-purple-400">AI</span>
          </span>
        </Link>

        {/* Navigation Links */}
        <nav className="space-y-1">
          {navItems.map((item) => {
            const isActive = item.label === activeItem
            return (
              <Link
                key={item.label}
                href={item.href}
                onClick={() => isMobile && onCloseMobile?.()}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all group ${
                  isActive
                    ? "bg-purple-600/10 text-purple-400 border-l-2 border-purple-500 pl-2.5"
                    : "text-white/60 hover:bg-white/[0.03] hover:text-white"
                }`}
              >
                <item.icon
                  className={`h-4 w-4 ${
                    isActive
                      ? "text-purple-400"
                      : "text-white/40 group-hover:text-white/70"
                  }`}
                />
                {item.label}
              </Link>
            )
          })}
        </nav>
      </div>

      {/* User Profile / Sign Out */}
      <div className="pt-6 border-t border-[#1a1a1a] flex flex-col gap-4">
        <div className="flex items-center gap-3">
          {user?.photoURL ? (
            <Image
              src={user.photoURL}
              alt={teacherName}
              width={38}
              height={38}
              className="rounded-full border border-purple-500/30"
            />
          ) : (
            <div className="h-10 w-10 rounded-full bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-sm font-bold text-purple-300">
              {avatarFallback}
            </div>
          )}
          <div className="overflow-hidden">
            <p className="text-sm font-semibold text-white truncate">{teacherName}</p>
            <p className="text-xs text-white/40 truncate">{teacherEmail}</p>
          </div>
        </div>

        <button
          onClick={handleSignOut}
          className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border border-white/5 bg-white/[0.02] text-xs font-semibold text-white/70 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20 transition-all cursor-pointer"
        >
          <LogOut className="h-3.5 w-3.5" />
          Sign Out
        </button>
      </div>
    </>
  )

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="fixed top-0 bottom-0 left-0 z-30 hidden w-64 bg-[#0A0A0A] border-r border-[#1a1a1a] p-6 lg:flex flex-col justify-between">
        {sidebarContent(false)}
      </aside>

      {/* Mobile Sidebar (Drawer) */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onCloseMobile}
          />

          <aside className="relative flex flex-col justify-between w-64 bg-[#0A0A0A] border-r border-[#1a1a1a] p-6 h-full z-10 animate-slideRight">
            {/* Close button */}
            <button
              onClick={onCloseMobile}
              className="absolute top-4 right-4 text-white/60 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="h-full flex flex-col justify-between mt-4">
              {sidebarContent(true)}
            </div>
          </aside>
        </div>
      )}
    </>
  )
}
