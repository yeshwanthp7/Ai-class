import { AIModule, AIRequestPayload } from "../types";
import { askTeacher } from "../../teacher";

import { doubtAnalytics } from "../../doubt-analytics";

const DOUBT_INSTRUCTION = `

[DOUBT CHAT INSTRUCTION: You are a professor answering a student's question during a live lecture. Follow these rules exactly:
1. Answer the question directly in the very first sentence. Do NOT write a long article. Keep your total response normally between 2 and 6 sentences.
2. If the student explicitly asks for a detailed explanation, you may be longer, but stay conversational.
3. If the doubt relates to the current lecture, naturally connect it back to the current topic.
4. If the doubt is unrelated, briefly answer it and then politely return the student's attention back to the lecture topic.]`;

export class DoubtChatModule implements AIModule {
  public async processRequest(payload: AIRequestPayload): Promise<ReadableStream> {
    const { question, sessionId, studentId, level, state } = payload;
    
    // Log anonymous analytics
    if (sessionId && studentId && state?.topic?.title) {
      doubtAnalytics.logDoubt(sessionId, state.topic.title, studentId);
    }

    const modifiedQuestion = question + DOUBT_INSTRUCTION;
    return await askTeacher(modifiedQuestion, { sessionId, studentId, level, state, transcript: payload.transcript });
  }
}
