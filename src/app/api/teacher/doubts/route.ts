import { NextRequest, NextResponse } from "next/server";
import { doubtAnalytics } from "@/lib/doubt-analytics";

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("sessionId");
  
  if (!sessionId) {
    return NextResponse.json({ error: "Missing sessionId parameter" }, { status: 400 });
  }

  const stats = doubtAnalytics.getStats(sessionId);
  return NextResponse.json(stats);
}
