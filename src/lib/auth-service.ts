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
import { auth, googleProvider, db } from "./firebase"
import { doc, setDoc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore"

// Helper: Save user profile to Firestore
export const saveUserProfile = async (
  uid: string,
  email: string | null,
  displayName: string | null,
  role: string
) => {
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
  return onAuthStateChanged(auth, callback)
}
export type { User }

