import { Message, MemoryAdapter } from "./types";

export class InMemoryMemoryAdapter implements MemoryAdapter {
  private memory = new Map<string, Message[]>();

  public async getHistory(sessionKey: string): Promise<Message[]> {
    return this.memory.get(sessionKey) || [];
  }

  public async addMessage(sessionKey: string, message: Message): Promise<void> {
    const history = this.memory.get(sessionKey) || [];
    history.push(message);
    this.memory.set(sessionKey, history);
  }

  public async clearHistory(sessionKey: string): Promise<void> {
    this.memory.delete(sessionKey);
  }
}

// Global memory instance
export const defaultMemoryStore = new InMemoryMemoryAdapter();
export const DEFAULT_SESSION_ID = "default-teacher-session";
