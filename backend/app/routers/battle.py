from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, Dict
from app.websocket import manager

router = APIRouter(prefix="/battle", tags=["Battle & Multiplayer"])

class BattleControlPayload(BaseModel):
    session_id: str
    action: str  # "start", "pause", "reset", "score_update", "round_end"
    duration: int = 30
    scores: Optional[Dict[str, int]] = None
    winner: Optional[str] = None

@router.post("/action")
async def trigger_battle_action(payload: BattleControlPayload):
    """Synchronize battle action (timer start, pause, reset, or end) across all session clients."""
    await manager.broadcast(payload.session_id, {
        "type": "BATTLE_ACTION",
        "action": payload.action,
        "duration": payload.duration,
        "scores": payload.scores or {},
        "winner": payload.winner
    })
    return {"status": "broadcast_complete", "action": payload.action}
