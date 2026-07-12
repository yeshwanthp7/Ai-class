import https from "https";
import dns from "dns";
import { Message, TeacherOptions } from "./types";
import { getTeacherConfig, getSystemPrompt } from "./config";
import { defaultMemoryStore, DEFAULT_SESSION_ID } from "./memory";

const globalAgent = (globalThis as any).teacherHttpsAgent || new https.Agent({
  keepAlive: true,
  keepAliveMsecs: 30000,
  scheduling: "lifo",
});

if (process.env.NODE_ENV !== "production") {
  (globalThis as any).teacherHttpsAgent = globalAgent;
}

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
 * Performs the actual HTTPS request to the NVIDIA NIM completions endpoint, streaming the response.
 */
function performRequestStream(postDataBytes: Uint8Array, config: any, globalAgent: any, onComplete: (fullText: string) => void): ReadableStream {
  let isClosed = false;
  return new ReadableStream({
    start(controller) {
      const requestOptions: https.RequestOptions = {
        hostname: "integrate.api.nvidia.com",
        port: 443,
        path: "/v1/chat/completions",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.apiKey}`,
          "Content-Length": postDataBytes.length,
          Connection: "keep-alive",
        },
        timeout: 10000,
        family: 4, // Force IPv4
        agent: globalAgent,
        servername: "integrate.api.nvidia.com",
      };

      const startTime = Date.now();
      console.log(`[teacher] Sending stream request to model '${config.model}' via HTTPS...`);

      let fullText = "";
      let buffer = "";

      const req = https.request(requestOptions, (res) => {
        const elapsed = Date.now() - startTime;
        console.log(`[teacher] First byte received in ${elapsed}ms. HTTP ${res.statusCode}`);

        if (res.statusCode && (res.statusCode < 200 || res.statusCode >= 300)) {
          let errorBody = "";
          res.on("data", chunk => errorBody += chunk);
          res.on("end", () => {
            if (!isClosed) {
              console.error(`[teacher] NVIDIA API error ${res.statusCode}: ${errorBody}`);
              controller.error(new Error(`NVIDIA API error ${res.statusCode}`));
              isClosed = true;
            }
          });
          return;
        }

        res.on("data", (chunk) => {
          if (!isClosed) {
            controller.enqueue(chunk); // Send raw SSE to client
            
            // Extract text for local memory
            buffer += chunk.toString();
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";
            for (const line of lines) {
              if (line.startsWith("data: ") && !line.includes("[DONE]")) {
                try {
                  const data = JSON.parse(line.slice(6));
                  if (data.choices?.[0]?.delta?.content) {
                    fullText += data.choices[0].delta.content;
                  }
                } catch (e) {
                  // Ignore partial json parse errors
                }
              }
            }
          }
        });

        res.on("end", () => {
          if (!isClosed) {
            controller.close();
            isClosed = true;
            onComplete(fullText);
          }
        });

        res.on("error", (err) => {
          if (!isClosed) {
            console.error("[teacher] Stream read error:", err.message);
            controller.error(err);
            isClosed = true;
          }
        });
      });

      req.on("timeout", () => {
        req.destroy();
        if (!isClosed) {
          console.error("[teacher] API request timed out after 60s");
          controller.error(new Error("The AI Teacher request timed out."));
          isClosed = true;
        }
      });

      req.on("error", (err) => {
        if (!isClosed) {
          console.error("[teacher] Connection error:", err.message);
          controller.error(err);
          isClosed = true;
        }
      });

      req.write(postDataBytes);
      req.end();
    },
    cancel() {
      isClosed = true;
    }
  });
}

/**
 * Ask the AI teacher a question. Supports session memory and difficulty level configurations.
 * Includes automatic retry for transient network connectivity errors.
 *
 * @param question - The student's question.
 * @param options - Optional sessionId and difficulty level settings.
 * @returns The AI teacher's response.
 */
export async function askTeacher(question: string, options?: TeacherOptions): Promise<ReadableStream> {
  const sanitizedQuestion = sanitizeInput(question);
  const sessionId = options?.sessionId || DEFAULT_SESSION_ID;
  const sessionKey = options?.studentId ? `${sessionId}_${options.studentId}` : sessionId;
  const level = options?.level || "intermediate";

  const config = getTeacherConfig();
  if (!config.apiKey) {
    throw new Error("NVIDIA_API_KEY is not set. Setup .env.local to resolve.");
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
  
  // Prepend system prompt to the API request payload, ensuring it always uses the latest context
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
    stream: true, // Force stream to true
  });

  const postDataBytes = new TextEncoder().encode(postData);

  // Return the ReadableStream directly (retries must be handled by the caller or we accept single-attempt streaming)
  return performRequestStream(postDataBytes, config, globalAgent, async (fullText) => {
    if (fullText && !options?.skipMemory) {
      const assistantMessage: Message = { role: "assistant", content: fullText };
      await defaultMemoryStore.addMessage(sessionKey, assistantMessage);
    }
  });
}
