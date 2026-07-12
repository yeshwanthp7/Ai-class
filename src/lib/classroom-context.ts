export interface ContextMessage {
  id?: string;
  sender?: string;
  text?: string;
  time?: string;
  isAI?: boolean;
  role?: "system" | "user" | "assistant";
  content?: string;
}

export interface ClassroomState {
  sessionId: string;
  subject: string;
  module: string;
  topic: string;
  lessonGoal: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  studentLevel: string;
  currentProgress: number;
  previousTopics: string[];
  conversationHistory: ContextMessage[];
  classroomStatus: "Live" | "Scheduled" | "Active" | "Completed" | "idle";
}

class ClassroomContextManager {
  private state: ClassroomState = {
    sessionId: "",
    subject: "",
    module: "",
    topic: "",
    lessonGoal: "",
    difficulty: "intermediate",
    studentLevel: "undergraduate",
    currentProgress: 0,
    previousTopics: [],
    conversationHistory: [],
    classroomStatus: "idle",
  };
  
  private listeners: Set<(state: ClassroomState) => void> = new Set();

  public getState(): ClassroomState {
    return this.state;
  }

  public updateState(partialState: Partial<ClassroomState>) {
    this.state = { ...this.state, ...partialState };
    this.notify();
  }

  public addMessage(message: ContextMessage) {
    this.state.conversationHistory = [...this.state.conversationHistory, message];
    this.notify();
  }

  public updateMessage(id: string, update: Partial<ContextMessage>) {
    this.state.conversationHistory = this.state.conversationHistory.map(m => 
      m.id === id ? { ...m, ...update } : m
    );
    this.notify();
  }
  
  public setMessages(messages: ContextMessage[]) {
    this.state.conversationHistory = messages;
    this.notify();
  }

  public subscribe(listener: (state: ClassroomState) => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    this.listeners.forEach(listener => listener(this.state));
  }
}

export const classroomContext = new ClassroomContextManager();
