import { TeacherConfig } from "./types";
import { classroomContext } from "../classroom-context";

export const getTeacherConfig = (): TeacherConfig => {
  let groqKey = process.env.GROQ_API_KEY || "";
  const nvidiaKey = process.env.NVIDIA_API_KEY || "";
  
  // Proactive auto-discovery: scan for any env variable names/values starting with 'gsk_'
  if (!groqKey) {
    for (const key in process.env) {
      if (key.startsWith("gsk_")) {
        groqKey = key;
        break;
      }
      const val = process.env[key];
      if (val && val.startsWith("gsk_")) {
        groqKey = val;
        break;
      }
    }
  }
  
  let apiKey = "";
  let baseUrl = "";
  let model = "";
  
  if (groqKey) {
    apiKey = groqKey;
    baseUrl = "https://api.groq.com/openai/v1";
    model = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
  } else {
    apiKey = nvidiaKey;
    baseUrl = "https://integrate.api.nvidia.com/v1";
    model = process.env.NVIDIA_MODEL || "meta/llama-3.1-8b-instruct";
  }
  
  // Safe parsing of numeric values
  const rawTemp = process.env.NVIDIA_TEMPERATURE || process.env.GROQ_TEMPERATURE;
  const temperature = rawTemp ? parseFloat(rawTemp) : 0.2;
  
  const rawMaxTokens = process.env.NVIDIA_MAX_TOKENS || process.env.GROQ_MAX_TOKENS;
  const maxTokens = rawMaxTokens ? parseInt(rawMaxTokens, 10) : 384;

  return {
    apiKey,
    model,
    temperature: isNaN(temperature) ? 0.2 : temperature,
    maxTokens: isNaN(maxTokens) ? 384 : maxTokens,
    baseUrl,
  };
};

/**
 * Generates the system prompt tailored to the student's learning level.
 */
export const getSystemPrompt = (level: "beginner" | "intermediate" | "advanced" = "intermediate", state?: any, transcript?: string): string => {
  const context = state || classroomContext.getState();
  
  const basePrompt = `You are Professor AI, an experienced and highly engaging university lecturer speaking live to your students in a virtual classroom. You are NOT writing an article; you are speaking out loud.
Your teaching philosophy focuses on breaking difficult ideas into logical steps and encouraging critical thinking rather than just outputting raw answers.
Use relevant analogies, concrete examples, and real-world scenarios whenever appropriate.
Speak naturally in conversational, continuous spoken English, as if addressing students in real time. Avoid repetitive transitional phrases such as "Let's discuss...", "This concept outlines...", or "In this lesson...".
Always be truthful: never fabricate facts or code. If you are uncertain about something, clearly state your uncertainty.
Only generate quizzes, assignments, revision notes, summaries, or practice questions when the student explicitly requests them.`;

  const levelInstructions = {
    beginner: `Explain concepts in simple terms, avoiding heavy jargon. Use everyday analogies and explain basic terminology before building up.`,
    intermediate: `Provide balanced explanations with typical technical terms. Use standard analogies and assume basic familiarity with the subject.`,
    advanced: `Provide deep, highly technical insights. Skip introductory definitions, use advanced terminology, and reference industry-standard design patterns, architectures, or papers directly.`,
  };

  // Adapt subject if it defaults to Mathematics but the topic is clearly scientific
  let currentSubject = context.subject || "General Academic";
  const topicText = `${context.topic || ""} ${context.sessionId || ""} ${context.module || ""}`.toLowerCase();
  const scienceKeywords = [
    "physics", "gravity", "relativity", "quantum", "optics", "thermodynamics", 
    "mechanics", "astronomy", "force", "motion", "velocity", "acceleration", 
    "friction", "chemistry", "biology", "science", "cell", "atom", "molecule",
    "electric", "magnetic", "wave", "light", "energy", "circuit"
  ];
  if (currentSubject === "Mathematics" && scienceKeywords.some(kw => topicText.includes(kw))) {
    currentSubject = "Science (Physics / Chemistry / Biology)";
  }

  const contextDetails = `
[CLASSROOM CONTEXT]
Subject: ${currentSubject}
Module: ${context.module}
Topic: ${context.topic}
Lesson Goal: ${context.lessonGoal}
Student Level: ${context.studentLevel}
CurrentProgress: ${context.currentProgress}
Previous Topics: ${context.previousTopics?.join(", ") || "None"}
${context.currentSlideText ? `\n[CURRENT PDF/DOCUMENT PAGE CONTENT]:\n${context.currentSlideText}\n` : ""}
${transcript ? `\n[RECENT LECTURE TRANSCRIPT]\n${transcript}\n` : ""}

CRITICAL REQUIREMENT: You must NEVER generate lessons outside the selected Subject, Module, and Topic. The lecture must remain strictly within ${currentSubject}.
`;

  return `${basePrompt}\n${contextDetails}\n[STUDENT LEVEL: ${level.toUpperCase()}]\nInstruction for this level: ${levelInstructions[level]}

CRITICAL FORMATTING RULES - YOU MUST OBEY THESE:
1. Your response must be a continuous transcript of a spoken lecture.
2. NO MARKDOWN WHATSOEVER. Do not use asterisks (*) for bold or italics. Do not use hashes (#) for headings.
3. NEVER use section titles like "Introduction", "Overview", or "Summary".
4. NEVER use bullet points (-) or numbered lists (1., 2., 3.). If you must list items, use conversational transitions like "first", "secondly", or "another point is" in continuous paragraphs.
5. ONLY use code blocks when explicitly teaching programming or showing code. Otherwise, stick to plain text paragraphs.`;
};

