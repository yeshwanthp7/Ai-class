import { AIModule, AIRequestPayload } from "./types";
import { TeacherModule } from "./modules/teacher";
import { DoubtChatModule } from "./modules/doubt-chat";
import { classroomContext } from "../classroom-context";

class AIRouter {
  private modules: Record<string, AIModule> = {
    "teacher": new TeacherModule(),
    "doubt-chat": new DoubtChatModule(),
  };

  /**
   * Routes the incoming request to the appropriate AI Module.
   */
  public async routeRequest(payload: AIRequestPayload): Promise<ReadableStream> {
    const { target, state } = payload;

    if (!target) {
      throw new Error("AI Router Error: Missing target module.");
    }

    const module = this.modules[target];
    if (!module) {
      throw new Error(`AI Router Error: Module "${target}" not found or not yet implemented.`);
    }

    // Sync client state to the server singleton before processing
    if (state) {
      classroomContext.updateState(state);
      if (state.conversationHistory) {
        classroomContext.setMessages(state.conversationHistory);
      }
    }

    return await module.processRequest(payload);
  }
}

export const aiRouter = new AIRouter();
