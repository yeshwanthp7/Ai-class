import { AIModule, AIRequestPayload } from "../types";
import { askTeacher } from "../../teacher";

export class TeacherModule implements AIModule {
  public async processRequest(payload: AIRequestPayload): Promise<ReadableStream> {
    const { question, sessionId, level } = payload;
    return await askTeacher(question, { sessionId, level, skipMemory: true });
  }
}
