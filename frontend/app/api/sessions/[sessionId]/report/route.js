import { NextResponse } from "next/server";

export async function GET(request, { params }) {
  const { sessionId } = params;

  return NextResponse.json({
    session_id: sessionId,
    generated_at: new Date().toISOString(),
    metrics: {
      total_blinks: 42,
      duration_seconds: 180,
      average_blink_rate: 14.0,
      participants_count: 2,
      top_streak: 6
    },
    participants: [
      { id: "person-1", name: "PERSON 1", blinks: 24, avg_ear: 0.28 },
      { id: "person-2", name: "PERSON 2", blinks: 18, avg_ear: 0.26 }
    ]
  });
}
