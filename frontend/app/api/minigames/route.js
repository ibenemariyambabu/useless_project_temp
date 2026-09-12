import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    games: [
      { id: "blink_race", name: "Blink Quick-Draw Race", status: "ready" },
      { id: "battle_arena", name: "1v1 Head-to-Head Arena", status: "ready" },
      { id: "blink_hero", name: "Blink Hero Rhythm Minigame", status: "ready" },
      { id: "neo_pet", name: "Cyber-Lumen Virtual Pet Engine", status: "ready" }
    ]
  });
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  return NextResponse.json({
    status: "recorded",
    game: body.game_type || "blink_hero",
    score: body.score || 0,
    timestamp: Date.now()
  });
}
