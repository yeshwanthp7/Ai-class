export interface Message {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface TeacherConfig {
  apiKey: string;
  model: string;
  temperature: number;
  maxTokens: number;
  baseUrl: string;
}

export interface TeacherOptions {
  sessionId?: string;
  studentId?: string;
  level?: "beginner" | "intermediate" | "advanced";
  skipMemory?: boolean;
  state?: any;
  transcript?: string;
}

/**
 * MemoryAdapter defines the pluggable memory storage interface.
 * Can be swapped later with Redis, Firestore, or Vector memory.
 */
export interface MemoryAdapter {
  getHistory(sessionId: string): Promise<Message[]>;
  addMessage(sessionId: string, message: Message): Promise<void>;
  clearHistory(sessionId: string): Promise<void>;
}
