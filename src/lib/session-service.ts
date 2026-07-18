import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  onSnapshot,
  query,
  where,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore"
import { db } from "./firebase"

export interface Session {
  id: string
  code: string
  title: string
  subject: string
  gradeLevel: string
  duration: string
  type: "Public" | "Private"
  topics: string[]
  currentTopicIndex: number
  status: "Live" | "Scheduled" | "Active" | "Completed"
  teacherId: string
  createdAt: any
  scheduledAt?: any
  teachingMode?: "AI" | "Human"
  aiInstructions?: string
  aiAssistants?: {
    generateVisuals: boolean
    doubtChat: boolean
    suggestVideos: boolean
    sessionNotes: boolean
    postSummary: boolean
  }
  uploadedFile?: {
    name: string
    size: string
    pages: number
  } | null
  referenceMaterial?: {
    name: string
    size: string
  } | null
  focusMode?: boolean
  allowLateJoins?: boolean
  muteOnEntry?: boolean
  countdownEndsAt?: any
}

export interface Student {
  id: string
  name: string
  joinedAt: any
  lastActive: any
  status: "active" | "idle" | "distracted" | "offline"
  engagementScore: number
}

// 1. Create a session document in Firestore
export const createSession = async (
  teacherId: string,
  title: string,
  subject: string,
  gradeLevel: string,
  duration: string,
  type: "Public" | "Private",
  topics: string[],
  code: string,
  scheduledDate?: string,
  extraSettings?: {
    teachingMode?: "AI" | "Human"
    aiInstructions?: string
    aiAssistants?: {
      generateVisuals: boolean
      doubtChat: boolean
      suggestVideos: boolean
      sessionNotes: boolean
      postSummary: boolean
    }
    uploadedFile?: {
      name: string
      size: string
      pages: number
    } | null
    referenceMaterial?: {
      name: string
      size: string
    } | null
  }
): Promise<string> => {
  try {
    const sessionRef = doc(db, "sessions", code)
    
    let scheduledAt = null
    let countdownEndsAt = null
    
    if (scheduledDate) {
      const targetDate = new Date(scheduledDate)
      scheduledAt = Timestamp.fromDate(targetDate)
      countdownEndsAt = Timestamp.fromDate(targetDate)
    } else {
      // Countdown ends in 2 minutes (120 seconds) for immediate start
      countdownEndsAt = Timestamp.fromDate(new Date(Date.now() + 120 * 1000))
    }

    const sessionData: Partial<Session> = {
      id: code,
      code,
      title,
      subject,
      gradeLevel,
      duration,
      type,
      topics,
      currentTopicIndex: 0,
      status: scheduledDate ? "Scheduled" : "Live",
      teacherId,
      createdAt: serverTimestamp(),
      focusMode: false,
      allowLateJoins: true,
      muteOnEntry: true,
      ...(scheduledAt && { scheduledAt }),
      ...(countdownEndsAt && { countdownEndsAt }),
      ...extraSettings,
    }

    await setDoc(sessionRef, sessionData)
    return code
  } catch (error) {
    console.error("Error creating session:", error)
    throw error
  }
}

// 1.1 Update teacher controls
export const updateSessionControls = async (
  sessionCode: string,
  controls: {
    focusMode?: boolean
    allowLateJoins?: boolean
    muteOnEntry?: boolean
  }
): Promise<void> => {
  try {
    const sessionRef = doc(db, "sessions", sessionCode.trim().toUpperCase())
    await updateDoc(sessionRef, controls)
  } catch (error) {
    console.error("Error updating controls:", error)
    throw error
  }
}

// 1.2 Start class early (force transition)
export const startClassEarly = async (sessionCode: string): Promise<void> => {
  try {
    const sessionRef = doc(db, "sessions", sessionCode.trim().toUpperCase())
    await updateDoc(sessionRef, {
      status: "Active",
      countdownEndsAt: Timestamp.fromDate(new Date(Date.now())),
    })
  } catch (error) {
    console.error("Error starting class early:", error)
    throw error
  }
}

// 2. Join session as a student
export const joinSession = async (
  studentName: string,
  sessionCode: string
): Promise<string> => {
  try {
    const formattedCode = sessionCode.trim().toUpperCase()
    const sessionRef = doc(db, "sessions", formattedCode)
    const sessionSnap = await getDoc(sessionRef)

    if (!sessionSnap.exists()) {
      throw new Error("Session not found. Please check the code.")
    }

    const sessionData = sessionSnap.data() as Session
    if (sessionData.status === "Completed") {
      throw new Error("This session has already ended.")
    }

    if (sessionData.status === "Active") {
      throw new Error("This session has already started. Late joins are not allowed.")
    }

    // Check if name is blacklisted/kicked
    const nameLower = studentName.trim().toLowerCase()
    let isKicked = false
    try {
      const kickedColRef = collection(db, "sessions", formattedCode, "kicked")
      const kickedQuery = query(kickedColRef, where("nameLower", "==", nameLower))
      const kickedSnap = await getDocs(kickedQuery)
      isKicked = !kickedSnap.empty
    } catch (e) {
      // ponytail: Fallback to false if kicked rules aren't deployed in the Firebase Console
      console.warn("Failed to check blacklisted students (likely missing firestore.rules update):", e)
    }

    if (isKicked) {
      throw new Error("You have been kicked from this session and cannot rejoin.")
    }

    // Use name as part of ID, lower-cased and stripped of spaces
    const studentId = nameLower.replace(/\s+/g, "-") + "-" + Date.now().toString().slice(-4)
    const studentRef = doc(db, "sessions", formattedCode, "students", studentId)

    const studentData: Student = {
      id: studentId,
      name: studentName,
      joinedAt: serverTimestamp(),
      lastActive: serverTimestamp(),
      status: "active",
      engagementScore: 100,
    }

    await setDoc(studentRef, studentData)

    // Save student profile to global users collection in Firestore
    try {
      const globalUserRef = doc(db, "users", studentId)
      await setDoc(globalUserRef, {
        uid: studentId,
        displayName: studentName,
        role: "student",
        createdAt: serverTimestamp(),
        lastLogin: serverTimestamp(),
      })
    } catch (e) {
      console.warn("Failed to create global user profile for student:", e)
    }

    return studentId
  } catch (error) {
    console.error("Error joining session:", error)
    throw error
  }
}

// 3. Subscribe to session updates
export const subscribeToSession = (
  sessionCode: string,
  onUpdate: (session: Session | null) => void,
  onError?: (error: any) => void
) => {
  const sessionRef = doc(db, "sessions", sessionCode.trim().toUpperCase())
  return onSnapshot(
    sessionRef,
    (docSnap) => {
      if (docSnap.exists()) {
        onUpdate(docSnap.data() as Session)
      } else {
        onUpdate(null)
      }
    },
    (err) => {
      console.error("Session subscription error:", err)
      if (onError) onError(err)
    }
  )
}

// 4. Subscribe to student list updates
export const subscribeToStudents = (
  sessionCode: string,
  onUpdate: (students: Student[]) => void,
  onError?: (error: any) => void
) => {
  const studentsColRef = collection(db, "sessions", sessionCode.trim().toUpperCase(), "students")
  return onSnapshot(
    studentsColRef,
    (querySnap) => {
      const studentsList: Student[] = []
      querySnap.forEach((docSnap) => {
        studentsList.push(docSnap.data() as Student)
      })
      onUpdate(studentsList)
    },
    (err) => {
      console.error("Students list subscription error:", err)
      if (onError) onError(err)
    }
  )
}

// 5. Update session's current active topic index
export const updateSessionTopic = async (
  sessionCode: string,
  topicIndex: number
): Promise<void> => {
  try {
    const sessionRef = doc(db, "sessions", sessionCode.trim().toUpperCase())
    await updateDoc(sessionRef, {
      currentTopicIndex: topicIndex,
    })
  } catch (error) {
    console.error("Error updating topic:", error)
    throw error
  }
}

// 6. Update student presence & engagement telemetry
export const updateStudentEngagement = async (
  sessionCode: string,
  studentId: string,
  score: number,
  status: "focused" | "distracted" | "away" | "offline" | "sleeping" | "phone"
): Promise<void> => {
  try {
    const studentRef = doc(db, "sessions", sessionCode.trim().toUpperCase(), "students", studentId)
    await setDoc(studentRef, {
      id: studentId,
      name: studentId, // Fallback if they didn't join properly
      engagementScore: score,
      status,
      lastActive: serverTimestamp(),
    }, { merge: true })
  } catch (error) {
    console.error("Error updating engagement telemetry:", error)
    throw error
  }
}

// 6.5 Remove student explicitly when they leave
import { deleteDoc } from "firebase/firestore";

export const removeStudent = async (sessionCode: string, studentId: string): Promise<void> => {
  try {
    const studentRef = doc(db, "sessions", sessionCode.trim().toUpperCase(), "students", studentId)
    await deleteDoc(studentRef);
  } catch (error) {
    console.error("Error removing student:", error);
  }
}

// 7. End session
export const endSession = async (sessionCode: string): Promise<void> => {
  try {
    const sessionRef = doc(db, "sessions", sessionCode.trim().toUpperCase())
    await updateDoc(sessionRef, {
      status: "Completed",
    })
  } catch (error) {
    console.error("Error ending session:", error)
    throw error
  }
}

// 8. Sync classroom progress (Teacher to Students)
export const syncClassroomProgress = async (sessionCode: string, currentTopicIndex: number): Promise<void> => {
  try {
    const sessionRef = doc(db, "sessions", sessionCode.trim().toUpperCase())
    await updateDoc(sessionRef, { currentTopicIndex })
  } catch (error) {
    console.error("Error syncing classroom progress:", error)
  }
}

// 9. Kick student explicitly and blacklist them
export const kickStudent = async (
  sessionCode: string,
  studentId: string,
  studentName: string
): Promise<void> => {
  try {
    const code = sessionCode.trim().toUpperCase()
    await removeStudent(code, studentId)

    const kickedRef = doc(db, "sessions", code, "kicked", studentId)
    await setDoc(kickedRef, {
      id: studentId,
      name: studentName,
      nameLower: studentName.trim().toLowerCase(),
      kickedAt: serverTimestamp(),
    })
  } catch (error) {
    console.error("Error kicking student:", error)
  }
}

// 10. Check if student name is kicked/blacklisted
export const checkIsKicked = async (
  sessionCode: string,
  studentName: string
): Promise<boolean> => {
  try {
    const code = sessionCode.trim().toUpperCase()
    const kickedColRef = collection(db, "sessions", code, "kicked")
    const q = query(kickedColRef, where("nameLower", "==", studentName.trim().toLowerCase()))
    const snap = await getDocs(q)
    return !snap.empty
  } catch {
    return false
  }
}

// 11. Check if student ID is kicked/blacklisted
export const checkIsIdKicked = async (
  sessionCode: string,
  studentId: string
): Promise<boolean> => {
  try {
    const code = sessionCode.trim().toUpperCase()
    const docRef = doc(db, "sessions", code, "kicked", studentId)
    const snap = await getDoc(docRef)
    return snap.exists()
  } catch {
    return false
  }
}

// 12. Check if student ID exists in the active/registered student collection
export const isStudentRegistered = async (
  sessionCode: string,
  studentId: string
): Promise<boolean> => {
  try {
    const code = sessionCode.trim().toUpperCase()
    const studentRef = doc(db, "sessions", code, "students", studentId)
    const snap = await getDoc(studentRef)
    return snap.exists()
  } catch {
    return false
  }
}

// 13. Set student presence status to offline
export const setStudentOffline = async (
  sessionCode: string,
  studentId: string
): Promise<void> => {
  try {
    const code = sessionCode.trim().toUpperCase()
    const studentRef = doc(db, "sessions", code, "students", studentId)
    await updateDoc(studentRef, {
      status: "offline",
      lastActive: serverTimestamp(),
    })
  } catch (error) {
    console.error("Error setting student offline:", error)
  }
}

export interface KickedStudent {
  id: string
  name: string
  nameLower: string
  kickedAt: any
}

// 14. Subscribe to kicked list updates
export const subscribeToKicked = (
  sessionCode: string,
  onUpdate: (kicked: KickedStudent[]) => void,
  onError?: (error: any) => void
) => {
  const kickedColRef = collection(db, "sessions", sessionCode.trim().toUpperCase(), "kicked")
  return onSnapshot(
    kickedColRef,
    (querySnap) => {
      const kickedList: KickedStudent[] = []
      querySnap.forEach((docSnap) => {
        kickedList.push(docSnap.data() as KickedStudent)
      })
      onUpdate(kickedList)
    },
    (err) => {
      console.error("Kicked list subscription error:", err)
      if (onError) onError(err)
    }
  )
}

// 15. Fetch all sessions for a specific teacher with student counts
export const getTeacherSessions = async (teacherId: string): Promise<Array<Session & { studentCount: number }>> => {
  try {
    const sessionsRef = collection(db, "sessions")
    const q = query(sessionsRef, where("teacherId", "==", teacherId))
    const snap = await getDocs(q)
    const list: Session[] = []
    snap.forEach((doc) => {
      list.push(doc.data() as Session)
    })
    
    // Fetch student counts for each session concurrently
    const listWithCounts = await Promise.all(
      list.map(async (sess) => {
        try {
          const studentsCol = collection(db, "sessions", sess.code, "students")
          const studentsSnap = await getDocs(studentsCol)
          
          const kickedCol = collection(db, "sessions", sess.code, "kicked")
          const kickedSnap = await getDocs(kickedCol)
          
          return {
            ...sess,
            studentCount: studentsSnap.size + kickedSnap.size
          }
        } catch {
          return { ...sess, studentCount: 0 }
        }
      })
    )

    // Sort by creation time desc
    return listWithCounts.sort((a, b) => {
      const aTime = a.createdAt?.seconds ? a.createdAt.seconds * 1000 : (a.createdAt ? new Date(a.createdAt).getTime() : 0)
      const bTime = b.createdAt?.seconds ? b.createdAt.seconds * 1000 : (b.createdAt ? new Date(b.createdAt).getTime() : 0)
      return bTime - aTime
    })
  } catch (error) {
    console.error("Error fetching teacher sessions:", error)
    return []
  }
}

export interface RosterStudent {
  name: string
  classesAttended: number
  avgEngagement: number
}

// 16. Compile unique students roster across sessions
export const getTeacherStudentsRoster = async (sessionCodes: string[]): Promise<RosterStudent[]> => {
  try {
    const studentMap: Record<string, { name: string; count: number; totalScore: number }> = {}
    
    await Promise.all(
      sessionCodes.map(async (code) => {
        try {
          const studentsCol = collection(db, "sessions", code, "students")
          const snap = await getDocs(studentsCol)
          snap.forEach((doc) => {
            const data = doc.data()
            const name = data.name || "Unknown Student"
            const nameKey = name.trim().toLowerCase()
            const score = data.engagementScore || 0
            
            if (studentMap[nameKey]) {
              studentMap[nameKey].count += 1
              studentMap[nameKey].totalScore += score
            } else {
              studentMap[nameKey] = {
                name,
                count: 1,
                totalScore: score
              }
            }
          })
        } catch {
          // ignore read errors for single session
        }
      })
    )
    
    return Object.values(studentMap).map((std) => ({
      name: std.name,
      classesAttended: std.count,
      avgEngagement: Math.floor(std.totalScore / std.count),
    }))
  } catch (error) {
    console.error("Error building student roster:", error)
    return []
  }
}




