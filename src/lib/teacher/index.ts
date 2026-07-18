import { Message, TeacherOptions } from "./types";
import { getTeacherConfig, getSystemPrompt } from "./config";
import { defaultMemoryStore, DEFAULT_SESSION_ID } from "./memory";

/**
 * Basic input validation and prompt injection detection.
 */
function sanitizeInput(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error("Input question cannot be empty.");
  }

  // Detect common prompt injection attack patterns
  const injectionPatterns = [
    /ignore\s+(?:previous|all|prior)\s+instructions/i,
    /system\s+prompt/i,
    /you\s+are\s+now\s+a/i,
    /acting\s+as\s+a/i,
    /dan\s+mode/i,
  ];

  for (const pattern of injectionPatterns) {
    if (pattern.test(trimmed)) {
      console.warn(`[teacher] Potential prompt injection detected: "${trimmed}"`);
      throw new Error("Invalid request content. Please ask a direct question.");
    }
  }

  return trimmed;
}

/**
 * Ask the AI teacher a question. Supports session memory and difficulty level configurations.
 * Uses standard fetch API for high compatibility with serverless environments like Vercel.
 *
 * @param question - The student's question.
 * @param options - Optional sessionId and difficulty level settings.
 * @returns The AI teacher's response stream.
 */
export async function askTeacher(question: string, options?: TeacherOptions): Promise<ReadableStream> {
  const sanitizedQuestion = sanitizeInput(question);
  const sessionId = options?.sessionId || DEFAULT_SESSION_ID;
  const sessionKey = options?.studentId ? `${sessionId}_${options.studentId}` : sessionId;
  const level = options?.level || "intermediate";

  const config = getTeacherConfig();
  if (!config.apiKey) {
    const topic = options?.state?.topic || "artificial intelligence";
    const mockResponseText = getMockTeacherResponse(question, topic, level);
    return createMockStream(mockResponseText);
  }

  // Retrieve session history
  let history: Message[] = [];
  if (!options?.skipMemory) {
    history = await defaultMemoryStore.getHistory(sessionKey);

    // Append user's new question
    const userMessage: Message = { role: "user", content: sanitizedQuestion };
    await defaultMemoryStore.addMessage(sessionKey, userMessage);
    history = await defaultMemoryStore.getHistory(sessionKey); // reload updated history
  }

  // Dynamically generate the latest system prompt
  const systemPrompt = getSystemPrompt(level, options?.state, options?.transcript);
  
  // Prepend system prompt to the API request payload
  const apiMessages = [
    { role: "system", content: systemPrompt },
    ...history.map(msg => ({ role: msg.role, content: msg.content }))
  ];

  const postData = JSON.stringify({
    model: config.model,
    messages: apiMessages,
    temperature: config.temperature,
    top_p: 0.7,
    max_tokens: config.maxTokens,
    stream: true,
  });

  console.log(`[teacher] Sending stream request to model '${config.model}' via fetch API...`);
  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: postData,
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error(`[teacher] NVIDIA API error ${response.status}: ${errText}`);
    throw new Error(`NVIDIA API error ${response.status}: ${errText}`);
  }

  const stream = response.body;
  if (!stream) {
    throw new Error("No response stream returned from NVIDIA API");
  }

  // If memory is not skipped, we read the stream in the background to save the assistant's answer
  if (!options?.skipMemory) {
    const [clientStream, memoryStream] = stream.tee();
    
    (async () => {
      try {
        const reader = memoryStream.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let fullText = "";
        
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";
          
          for (const line of lines) {
            if (line.startsWith("data: ") && !line.includes("[DONE]")) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.choices?.[0]?.delta?.content) {
                  fullText += data.choices[0].delta.content;
                }
              } catch {}
            }
          }
        }
        
        if (fullText) {
          const assistantMessage: Message = { role: "assistant", content: fullText };
          await defaultMemoryStore.addMessage(sessionKey, assistantMessage);
        }
      } catch (err) {
        console.error("[teacher] Error parsing background memory stream:", err);
      }
    })();

    return clientStream;
  }

  return stream;
}

function getMockTeacherResponse(question: string, topic?: string, level: string = "intermediate"): string {
  const currentTopic = topic || "this topic";
  const questionLower = question.toLowerCase();
  
  if (questionLower.includes("hello") || questionLower.includes("hi")) {
    return `Hello class! Welcome to today's lecture. Let's make sure we are focused and ready to dive into ${currentTopic}. If you have questions as we go, just ask.`;
  }
  
  if (questionLower.includes("doubt") || questionLower.includes("explain") || questionLower.includes("what is") || questionLower.includes("why")) {
    return `That is an excellent question. When we think about the concept, we have to understand the fundamental principles. Let's break this down. First, the core concept relies on structuring our information. Secondly, we examine how it interacts with other modules. Lastly, we apply it to practical scenarios to optimize performance. Does this explanation help clarify things for you?`;
  }
  
  // Default lecture speech
  return `Now, let's explore ${currentTopic} in more depth. To understand this properly, think of it like building a house. First, you need a strong foundation of basic rules and parameters. Secondly, you add the structural components which define the core logic. Finally, you decorate it with custom styles and animations. Throughout this process, keeping our design clean and efficient is key. Let's look at the slides to visualize this concept.`;
}

function createMockStream(text: string): ReadableStream {
  const words = text.split(" ");
  let wordIndex = 0;
  let interval: any;
  return new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      interval = setInterval(() => {
        if (wordIndex < words.length) {
          const word = words[wordIndex] + (wordIndex < words.length - 1 ? " " : "");
          const sseLine = `data: ${JSON.stringify({
            choices: [{ delta: { content: word } }]
          })}\n\n`;
          controller.enqueue(encoder.encode(sseLine));
          wordIndex++;
        } else {
          // Send [DONE] line to match real SSE streaming behavior
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          clearInterval(interval);
          controller.close();
        }
      }, 60); // send a word every 60ms
    },
    cancel() {
      if (interval) clearInterval(interval);
    }
  });
}
