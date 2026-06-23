"use client"

import React, { useState, useEffect } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { AlertCircle } from "lucide-react"

import {
  subscribeToSession,
  subscribeToStudents,
  Session,
  Student,
} from "@/lib/session-service"
import { subscribeToAuthChanges } from "@/lib/auth-service"
import ClassroomView from "@/components/classroom-view"

export default function ClassroomRoutePage() {
  const params = useParams()
  const sessionCode = (params.code as string).toUpperCase()

  // Authentication & Role
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [isTeacher, setIsTeacher] = useState(false)
  const [studentId, setStudentId] = useState<string | null>(null)
  const [studentName, setStudentName] = useState<string | null>(null)

  // Real-time Database state
  const [session, setSession] = useState<Session | null>(null)
  const [studentsList, setStudentsList] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // 1. Mount logger
  useEffect(() => {
    console.log("Classroom mounted")
  }, [])

  // 2. Load identities from LocalStorage & Auth
  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedName = localStorage.getItem("studentName")
      const storedId = localStorage.getItem("studentId")
      setStudentName(storedName)
      setStudentId(storedId)
    }

    const unsubscribeAuth = subscribeToAuthChanges((user) => {
      setCurrentUser(user)
    })
    return () => unsubscribeAuth()
  }, [])

  // 3. Load Firestore Data
  useEffect(() => {
    if (!sessionCode) return

    const unsubscribeSession = subscribeToSession(
      sessionCode,
      (updatedSession) => {
        if (!updatedSession) {
          setError("Failed to load session. Return to dashboard?")
          setLoading(false)
        } else {
          setSession(updatedSession)
          setError(null)
          setLoading(false)
          console.log("Session data loaded")
        }
      },
      (err) => {
        console.error("Firebase error loading session:", err)
        setError("Failed to load session. Return to dashboard?")
        setLoading(false)
      }
    )

    const unsubscribeStudents = subscribeToStudents(
      sessionCode,
      (updatedStudents) => {
        setStudentsList(updatedStudents)
      },
      (err) => {
        console.error("Firebase error loading students:", err)
      }
    )

    return () => {
      unsubscribeSession()
      unsubscribeStudents()
    }
  }, [sessionCode])

  // 4. Determine if current user is the Teacher
  useEffect(() => {
    if (session && currentUser) {
      setIsTeacher(session.teacherId === currentUser.uid)
    } else {
      setIsTeacher(false)
    }
  }, [session, currentUser])

  // 5. Handle loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex flex-col items-center justify-center text-white font-sans">
        <div className="h-8 w-8 rounded-full border-2 border-purple-500 border-t-transparent animate-spin mb-4" />
        <p className="text-sm text-white/60">Entering classroom session...</p>
      </div>
    )
  }

  // 6. Handle error state (e.g. Firebase fails to load session data)
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

  // 7. Render full interactive ClassroomView
  return (
    <ClassroomView
      sessionCode={sessionCode}
      session={session}
      studentsList={studentsList}
      isTeacher={isTeacher}
      studentId={studentId}
      studentName={studentName}
    />
  )
}
