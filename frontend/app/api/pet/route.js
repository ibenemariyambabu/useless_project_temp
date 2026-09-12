import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    name: "CYBER-LUMEN",
    stage: "CYBER-EGG",
    level: 1,
    health: 100,
    energy: 100,
    happiness: 100,
    exp: 0,
    totalBlinksFed: 0
  });
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  return NextResponse.json({
    status: "updated",
    pet: body.pet || body,
    timestamp: Date.now()
  });
}
