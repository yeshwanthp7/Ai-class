import { initializeApp, getApps, getApp } from "firebase/app"
import { getAuth, GoogleAuthProvider } from "firebase/auth"
import { getFirestore } from "firebase/firestore"

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

// Next.js build/SSR safety guard: use a dummy configuration during static compilation
// if the environment variables are not present. On the client side, the actual credentials will load.
const hasApiKey = !!firebaseConfig.apiKey

export const isFirebaseConfigured = !!(
  firebaseConfig.apiKey &&
  firebaseConfig.apiKey !== "your-api-key" &&
  firebaseConfig.apiKey !== "AIzaSyDummyKeyForBuildSafetyOnly"
)

const activeConfig = hasApiKey
  ? firebaseConfig
  : {
      apiKey: "AIzaSyDummyKeyForBuildSafetyOnly",
      authDomain: "dummy-project.firebaseapp.com",
      projectId: "dummy-project",
      storageBucket: "dummy-project.appspot.com",
      messagingSenderId: "1234567890",
      appId: "1:1234567890:web:1234567890",
    }

const app = getApps().length === 0 ? initializeApp(activeConfig) : getApp()

export const auth = getAuth(app)
export const db = getFirestore(app)
export const googleProvider = new GoogleAuthProvider()

googleProvider.setCustomParameters({ prompt: "select_account" })

