import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json([
    {
      id: "entry-1",
      participant_name: "PERSON 1",
      total_blinks: 28,
      blink_rate: 14.5,
      longest_streak: 5,
      score: 340,
      accuracy: "96%"
    },
    {
      id: "entry-2",
      participant_name: "PERSON 2",
      total_blinks: 22,
      blink_rate: 11.2,
      longest_streak: 4,
      score: 290,
      accuracy: "92%"
    }
  ]);
}
