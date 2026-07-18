import {
  signInWithPopup,
  signInWithRedirect,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signOut,
  onAuthStateChanged,
  User,
} from "firebase/auth"
import { auth, googleProvider, db, isFirebaseConfigured } from "./firebase"
import { doc, setDoc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore"

// Helper: Save user profile to Firestore
export const saveUserProfile = async (
  uid: string,
  email: string | null,
  displayName: string | null,
  role: string
) => {
  if (!isFirebaseConfigured) return
  try {
    const userRef = doc(db, "users", uid)
    const userSnap = await getDoc(userRef)
    if (!userSnap.exists()) {
      await setDoc(userRef, {
        uid,
        email,
        displayName,
        role,
        createdAt: serverTimestamp(),
        lastLogin: serverTimestamp(),
      })
    } else {
      await updateDoc(userRef, {
        lastLogin: serverTimestamp(),
        ...(displayName && { displayName }),
      })
    }
  } catch (error) {
    console.error("Error saving user profile to Firestore:", error)
  }
}

// 1. Sign in with Google
export const signInWithGoogle = async (): Promise<User | null> => {
  if (!isFirebaseConfigured) {
    const mockUser = {
      uid: "mock-google-teacher-123",
      email: "teacher.mock@classai.edu",
      displayName: "Mock Google Teacher",
      emailVerified: true,
      isAnonymous: false,
    } as any
    if (typeof window !== "undefined") {
      localStorage.setItem("mock_current_user", JSON.stringify(mockUser))
    }
    return mockUser
  }
  try {
    const result = await signInWithPopup(auth, googleProvider)
    const user = result.user
    if (user) {
      await saveUserProfile(user.uid, user.email, user.displayName, "teacher")
    }
    return user
  } catch (error: any) {
    if (error.code === "auth/popup-blocked") {
      console.warn("Popup blocked, falling back to redirect...")
      await signInWithRedirect(auth, googleProvider)
      return null;
    }
    console.error("Google Sign-In Error:", error)
    throw error
  }
}

// 2. Sign in with Email and Password
export const signInWithEmail = async (
  email: string,
  password: string
): Promise<User> => {
  if (!isFirebaseConfigured) {
    const mockUser = {
      uid: "mock-teacher-" + email.replace(/[^a-zA-Z0-9]/g, "-"),
      email: email,
      displayName: email.split("@")[0].toUpperCase(),
    } as any
    if (typeof window !== "undefined") {
      localStorage.setItem("mock_current_user", JSON.stringify(mockUser))
    }
    return mockUser
  }
  try {
    const result = await signInWithEmailAndPassword(auth, email, password)
    const user = result.user
    await saveUserProfile(user.uid, user.email, user.displayName, "teacher")
    return user
  } catch (error) {
    console.error("Email Sign-In Error:", error)
    throw error
  }
}

// 3. Sign up with Email and Password (and set display name)
export const signUpWithEmail = async (
  email: string,
  password: string,
  fullName: string
): Promise<User> => {
  if (!isFirebaseConfigured) {
    const mockUser = {
      uid: "mock-teacher-" + email.replace(/[^a-zA-Z0-9]/g, "-"),
      email: email,
      displayName: fullName,
    } as any
    if (typeof window !== "undefined") {
      localStorage.setItem("mock_current_user", JSON.stringify(mockUser))
    }
    return mockUser
  }
  try {
    const result = await createUserWithEmailAndPassword(auth, email, password)
    const user = result.user
    // Update display name
    await updateProfile(user, {
      displayName: fullName,
    })
    // Save to Firestore under 'users' collection
    await saveUserProfile(user.uid, email, fullName, "teacher")
    return user
  } catch (error) {
    console.error("Email Sign-Up Error:", error)
    throw error
  }
}

// 4. Sign out
export const signOutUser = async (): Promise<void> => {
  if (!isFirebaseConfigured) {
    if (typeof window !== "undefined") {
      localStorage.removeItem("mock_current_user")
    }
    return
  }
  try {
    await signOut(auth)
  } catch (error) {
    console.error("Sign-Out Error:", error)
    throw error
  }
}

// 5. Auth State Subscriber
export const subscribeToAuthChanges = (
  callback: (user: User | null) => void
) => {
  if (!isFirebaseConfigured) {
    if (typeof window !== "undefined") {
      // Check and fire immediately
      const checkAndFire = () => {
        const stored = localStorage.getItem("mock_current_user")
        if (stored) {
          try {
            callback(JSON.parse(stored))
          } catch {
            callback(null)
          }
        } else {
          callback(null)
        }
      }
      checkAndFire()
      
      // Setup window event listener for changes from other tabs/actions
      const handleStorageChange = (e: StorageEvent) => {
        if (e.key === "mock_current_user") {
          checkAndFire()
        }
      }
      window.addEventListener("storage", handleStorageChange)
      
      // Also poll slightly just in case same-tab redirects happen
      const interval = setInterval(checkAndFire, 1000)

      return () => {
        window.removeEventListener("storage", handleStorageChange)
        clearInterval(interval)
      }
    }
    callback(null)
    return () => {}
  }
  return onAuthStateChanged(auth, callback)
}
export type { User }


