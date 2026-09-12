import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    return NextResponse.json({
      status: "recorded",
      id: `blk_${Date.now()}`,
      participant_id: body.participant_id || "unknown",
      timestamp: body.timestamp || Date.now()
    }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ status: "error", message: error.message }, { status: 400 });
  }
}
