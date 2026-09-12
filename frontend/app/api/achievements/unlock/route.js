import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    return NextResponse.json({
      status: "unlocked",
      achievement_id: body.id || body.achievement_id,
      unlocked_at: new Date().toISOString()
    });
  } catch (error) {
    return NextResponse.json({ status: "error", message: error.message }, { status: 400 });
  }
}
