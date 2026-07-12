export interface AIRequestPayload {
  question: string;
  target: "teacher" | "doubt-chat";
  sessionId?: string;
  studentId?: string;
  level?: "beginner" | "intermediate" | "advanced";
  state?: any; // The ClassroomContextManager state for syncing
  transcript?: string;
}

export interface AIModule {
  processRequest(payload: AIRequestPayload): Promise<ReadableStream>;
}
