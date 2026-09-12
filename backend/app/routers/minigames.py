from typing import List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc
from app.database import get_db
from app.models import MinigameScore, Session as SessionModel
from app.schemas import MinigameScoreCreate, MinigameScoreResponse
from app.websocket import manager

router = APIRouter(prefix="/minigames", tags=["Minigames"])

@router.post("/scores", response_model=MinigameScoreResponse)
async def submit_score(score_in: MinigameScoreCreate, db: Session = Depends(get_db)):
    """Submit a minigame score (rhythm, race, etc.) and broadcast to multiplayer room."""
    sess = db.query(SessionModel).filter(SessionModel.id == score_in.session_id).first()
    if not sess:
        raise HTTPException(status_code=404, detail=f"Session '{score_in.session_id}' not found.")

    score_record = MinigameScore(
        session_id=score_in.session_id,
        participant_name=score_in.participant_name,
        game_type=score_in.game_type,
        score=score_in.score,
        accuracy_pct=score_in.accuracy_pct,
        max_combo=score_in.max_combo,
        difficulty=score_in.difficulty
    )
    db.add(score_record)
    db.commit()
    db.refresh(score_record)

    # Broadcast minigame score to WebSocket room
    await manager.broadcast(score_in.session_id, {
        "type": "MINIGAME_SCORE",
        "game_type": score_record.game_type,
        "participant_name": score_record.participant_name,
        "score": score_record.score,
        "accuracy_pct": score_record.accuracy_pct,
        "max_combo": score_record.max_combo,
        "difficulty": score_record.difficulty,
        "id": score_record.id
    })

    return score_record

@router.get("/scores/{game_type}", response_model=List[MinigameScoreResponse])
def get_high_scores(game_type: str, limit: int = Query(10, ge=1, le=50), db: Session = Depends(get_db)):
    """Fetch all-time top high scores for a specific minigame."""
    scores = db.query(MinigameScore)\
        .filter(MinigameScore.game_type == game_type)\
        .order_by(desc(MinigameScore.score))\
        .limit(limit)\
        .all()
    return scores

@router.get("/session/{session_id}", response_model=List[MinigameScoreResponse])
def get_session_scores(session_id: str, db: Session = Depends(get_db)):
    """Fetch all minigame scores recorded in a specific session."""
    scores = db.query(MinigameScore)\
        .filter(MinigameScore.session_id == session_id)\
        .order_by(desc(MinigameScore.score))\
        .all()
    return scores
