import { NextResponse } from "next/server";

const DEFAULT_ACHIEVEMENTS = [
  { id: "first_blink", title: "FIRST LIGHT", description: "Successfully register your first optical blink.", icon: "👁️", unlocked: true },
  { id: "streak_3", title: "RAPID FIRE", description: "Trigger a 3-combo rapid blink streak.", icon: "⚡", unlocked: false },
  { id: "streak_5", title: "UNSTOPPABLE", description: "Trigger a 5-combo blink barrage.", icon: "🔥", unlocked: false },
  { id: "duel_victor", title: "REFLEX DUELIST", description: "Win a 1v1 battle arena reflex contest.", icon: "⚔️", unlocked: false },
  { id: "tamagotchi_adult", title: "CYBER EVOLUTION", description: "Evolve your Cyber-Lumen virtual pet to cyber-dino stage.", icon: "🦖", unlocked: false },
  { id: "rhythm_perfect", title: "OCULAR MAESTRO", description: "Achieve a 100% accuracy note run in Blink Hero.", icon: "🎵", unlocked: false }
];

export async function GET() {
  return NextResponse.json(DEFAULT_ACHIEVEMENTS);
}
