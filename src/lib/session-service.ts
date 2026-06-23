import {
  collection,
  doc,
  setDoc,
  getDoc,
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

    // Use name as part of ID, lower-cased and stripped of spaces
    const studentId = studentName.trim().toLowerCase().replace(/\s+/g, "-") + "-" + Date.now().toString().slice(-4)
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
  status: "active" | "idle" | "distracted" | "offline"
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
