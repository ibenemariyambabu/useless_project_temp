import { NextResponse } from "next/server";

export async function GET(request, { params }) {
  const { sessionId } = params;

  return NextResponse.json([
    {
      id: `lead_${sessionId}_1`,
      participant_name: "PERSON 1",
      total_blinks: 19,
      blink_rate: 13.0,
      longest_streak: 4,
      score: 240,
      accuracy: "95%"
    }
  ]);
}
