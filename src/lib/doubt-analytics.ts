export interface DoubtLog {
  timestamp: number;
  sessionId: string;
  topic: string;
  studentId: string;
}

class DoubtAnalyticsManager {
  private logs: DoubtLog[] = [];

  public logDoubt(sessionId: string, topic: string, studentId: string) {
    this.logs.push({
      timestamp: Date.now(),
      sessionId,
      topic,
      studentId
    });
  }

  public getStats(sessionId?: string) {
    const relevantLogs = sessionId ? this.logs.filter(l => l.sessionId === sessionId) : this.logs;
    
    const totalDoubts = relevantLogs.length;
    
    const topicCounts: Record<string, number> = {};
    relevantLogs.forEach(log => {
      topicCounts[log.topic] = (topicCounts[log.topic] || 0) + 1;
    });

    const uniqueStudents = new Set(relevantLogs.map(l => l.studentId)).size;

    return {
      totalDoubts,
      topicCounts,
      uniqueStudents
    };
  }
}

export const doubtAnalytics = new DoubtAnalyticsManager();
