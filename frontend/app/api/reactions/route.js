import { NextResponse } from "next/server";

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  return NextResponse.json({
    status: "dispatched",
    reaction: body.combo_type || body.reaction || "TRIPLE_BLINK",
    timestamp: Date.now()
  });
}
