import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const mode = body.mode || "standard";
    const sessionId = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const sessionCode = Math.random().toString(36).substring(2, 8).toUpperCase();

    return NextResponse.json({
      id: sessionId,
      session_code: sessionCode,
      mode: mode,
      status: "active",
      created_at: new Date().toISOString()
    }, { status: 201 });
  } catch (error) {
    return NextResponse.json({
      id: `local-session-${Date.now()}`,
      session_code: "LOCAL",
      mode: "standard",
      status: "fallback"
    }, { status: 200 });
  }
}

export async function GET() {
  return NextResponse.json({
    sessions: [],
    total: 0,
    timestamp: new Date().toISOString()
  });
}
