from typing import List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc
from app.database import get_db
from app.models import ReactionEvent, Session as SessionModel
from app.schemas import ReactionEventCreate, ReactionEventResponse
from app.websocket import manager

router = APIRouter(prefix="/reactions", tags=["Ocular Combos & Reactions"])

@router.post("/trigger", response_model=ReactionEventResponse)
async def trigger_reaction(react_in: ReactionEventCreate, db: Session = Depends(get_db)):
    """Record an ocular combo reaction and broadcast visual/audio effects across the room."""
    sess = db.query(SessionModel).filter(SessionModel.id == react_in.session_id).first()
    if not sess:
        raise HTTPException(status_code=404, detail=f"Session '{react_in.session_id}' not found.")

    event = ReactionEvent(
        session_id=react_in.session_id,
        participant_name=react_in.participant_name,
        combo_type=react_in.combo_type,
        emoji=react_in.emoji,
        title=react_in.title,
        timestamp=react_in.timestamp
    )
    db.add(event)
    db.commit()
    db.refresh(event)

    # Broadcast reaction across active room WebSockets
    await manager.broadcast(react_in.session_id, {
        "type": "COMBO_REACTION",
        "combo_type": event.combo_type,
        "emoji": event.emoji,
        "title": event.title,
        "participant_name": event.participant_name,
        "timestamp": event.timestamp,
        "id": event.id
    })

    return event

@router.get("/{session_id}", response_model=List[ReactionEventResponse])
def get_session_reactions(session_id: str, limit: int = Query(20, ge=1, le=100), db: Session = Depends(get_db)):
    """Fetch recent combo reaction history for a session."""
    events = db.query(ReactionEvent)\
        .filter(ReactionEvent.session_id == session_id)\
        .order_by(desc(ReactionEvent.created_at))\
        .limit(limit)\
        .all()
    return events
