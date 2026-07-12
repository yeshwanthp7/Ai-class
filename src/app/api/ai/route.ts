import "@/lib/dns-fix";
import { NextRequest, NextResponse } from "next/server";
import { aiRouter } from "@/lib/ai-router";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  console.log("[api/ai] POST received");
  try {
    const body = await req.json().catch(() => ({}));
    const question = body?.question;
    const target = body?.target;
    const sessionId = body?.sessionId;
    const studentId = body?.studentId;
    const level = body?.level;
    const state = body?.state;
    const transcript = body?.transcript;

    // Validate inputs
    if (!target) {
      return NextResponse.json({ error: "Missing 'target' field." }, { status: 400 });
    }

    if (typeof question !== "string" || !question.trim()) {
      return NextResponse.json({ error: "Missing or empty 'question' field." }, { status: 400 });
    }

    console.log(`[api/ai] Routing request to target: ${target}`);
    const stream = await aiRouter.routeRequest({ question, target, sessionId, studentId, level, state, transcript });
    console.log("[api/ai] Streaming Response initialized");
    
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive"
      }
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    const stack = err instanceof Error ? err.stack : undefined;

    console.error("[api/ai] Error occurred:", message);
    if (stack) console.error("[api/ai] Stack trace:", stack);

    let status = 502;
    if (message.includes("NVIDIA_API_KEY")) {
      status = 500;
    } else if (message.includes("Invalid request content") || message.includes("empty")) {
      status = 400;
    } else if (message.includes("AI Router Error")) {
      status = 400;
    }

    return NextResponse.json({ error: message }, { status });
  }
}
