from typing import List, Optional
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session as DBSession
from app.database import get_db
from app.models import LeaderboardEntry, Participant
from app.schemas import LeaderboardEntryResponse

router = APIRouter(prefix="/leaderboard", tags=["Leaderboard"])

@router.get("", response_model=List[LeaderboardEntryResponse])
def get_global_leaderboard(limit: int = 50, db: DBSession = Depends(get_db)):
    """Retrieve global all-time top blinkers."""
    entries = (
        db.query(LeaderboardEntry)
        .order_by(LeaderboardEntry.total_blinks.desc())
        .limit(limit)
        .all()
    )
    for idx, item in enumerate(entries, start=1):
        item.rank = idx
    return entries

@router.get("/session/{session_id}", response_model=List[LeaderboardEntryResponse])
def get_session_leaderboard(session_id: str, db: DBSession = Depends(get_db)):
    """Retrieve live leaderboard for a specific session sorted by total blinks."""
    # Also sync with active participants in case leaderboard entries need refresh
    participants = (
        db.query(Participant)
        .filter(Participant.session_id == session_id)
        .order_by(Participant.blink_count.desc())
        .all()
    )

    results = []
    for idx, p in enumerate(participants, start=1):
        results.append(
            LeaderboardEntryResponse(
                id=p.id,
                session_id=session_id,
                participant_name=p.name,
                participant_key=p.participant_key,
                color=p.color,
                total_blinks=p.blink_count,
                blink_rate=p.blink_rate,
                longest_streak=p.longest_streak,
                rank=idx,
                updated_at=p.last_seen
            )
        )
    return results
