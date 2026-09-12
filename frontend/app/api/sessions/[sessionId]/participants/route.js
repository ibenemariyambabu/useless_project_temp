import { NextResponse } from "next/server";

export async function POST(request, { params }) {
  try {
    const { sessionId } = params;
    const body = await request.json().catch(() => ({}));

    return NextResponse.json({
      status: "registered",
      session_id: sessionId,
      participant: {
        id: body.id || `p_${Date.now()}`,
        name: body.name || "Anonymous",
        color: body.color || "#00f2fe",
        joined_at: new Date().toISOString()
      }
    }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ status: "error", message: error.message }, { status: 400 });
  }
}
