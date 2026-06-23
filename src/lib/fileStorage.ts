const DB_NAME = "ClassroomFilesDB"
const STORE_NAME = "Files"

function initDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)

    request.onerror = (e) => reject("IndexedDB error: " + (e.target as any).error)

    request.onsuccess = (e) => resolve((e.target as any).result)

    request.onupgradeneeded = (e) => {
      const db = (e.target as any).result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
    }
  })
}

export async function saveFile(key: string, file: File): Promise<void> {
  const db = await initDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite")
    const store = tx.objectStore(STORE_NAME)
    const request = store.put(file, key)

    request.onsuccess = () => resolve()
    request.onerror = (e) => reject((e.target as any).error)
  })
}

export async function getFile(key: string): Promise<File | null> {
  const db = await initDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly")
    const store = tx.objectStore(STORE_NAME)
    const request = store.get(key)

    request.onsuccess = (e) => resolve((e.target as any).result || null)
    request.onerror = (e) => reject((e.target as any).error)
  })
}

export async function clearFiles(): Promise<void> {
  const db = await initDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite")
    const store = tx.objectStore(STORE_NAME)
    const request = store.clear()

    request.onsuccess = () => resolve()
    request.onerror = (e) => reject((e.target as any).error)
  })
}
