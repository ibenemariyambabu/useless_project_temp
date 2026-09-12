import uuid
import random
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session as DBSession
from app.database import get_db
from app.models import Session, Participant, BlinkEvent, AchievementRecord, LeaderboardEntry
from app.schemas import SessionCreate, SessionResponse, ParticipantCreate, ParticipantResponse, SessionEndResponse
from app.websocket import manager

router = APIRouter(prefix="/sessions", tags=["Sessions"])

def utcnow():
    return datetime.now(timezone.utc).replace(tzinfo=None)

def generate_session_code():
    return f"BLINK-{random.randint(1000, 9999)}"

@router.post("", response_model=SessionResponse)
def create_session(payload: SessionCreate, db: DBSession = Depends(get_db)):
    session_id = str(uuid.uuid4())
    code = payload.session_code or generate_session_code()
    
    # Check code uniqueness
    existing = db.query(Session).filter(Session.session_code == code).first()
    if existing:
        code = f"BLINK-{random.randint(10000, 99999)}"

    new_session = Session(
        id=session_id,
        session_code=code,
        user_id=payload.user_id,
        mode=payload.mode or "standard",
        start_time=utcnow(),
        is_active=True,
        total_blinks=0,
        duration_seconds=0.0
    )
    db.add(new_session)
    db.commit()
    db.refresh(new_session)
    return new_session

@router.get("/{session_id}", response_model=SessionResponse)
def get_session(session_id: str, db: DBSession = Depends(get_db)):
    session = db.query(Session).filter(Session.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session

@router.post("/{session_id}/participants", response_model=ParticipantResponse)
async def register_participant(session_id: str, payload: ParticipantCreate, db: DBSession = Depends(get_db)):
    session = db.query(Session).filter(Session.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Check if participant already exists in this session
    participant = db.query(Participant).filter(
        Participant.session_id == session_id,
        Participant.participant_key == payload.participant_key
    ).first()

    if participant:
        participant.name = payload.name
        participant.color = payload.color
        participant.baseline_ear = payload.baseline_ear
        participant.last_seen = utcnow()
        participant.is_active = True
    else:
        participant = Participant(
            session_id=session_id,
            participant_key=payload.participant_key,
            name=payload.name,
            color=payload.color,
            baseline_ear=payload.baseline_ear,
            blink_count=0,
            blink_rate=0.0,
            current_streak=0.0,
            longest_streak=0.0,
            last_seen=utcnow(),
            is_active=True
        )
        db.add(participant)
    
    db.commit()
    db.refresh(participant)

    # Broadcast participant presence update
    await manager.broadcast(session_id, {
        "type": "PARTICIPANT_JOINED",
        "participant": {
            "key": participant.participant_key,
            "name": participant.name,
            "color": participant.color,
            "blink_count": participant.blink_count,
            "blink_rate": participant.blink_rate
        }
    })

    return participant

@router.post("/{session_id}/end", response_model=SessionEndResponse)
async def end_session(session_id: str, db: DBSession = Depends(get_db)):
    session = db.query(Session).filter(Session.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    now = utcnow()
    session.end_time = now
    session.is_active = False
    
    # Calculate duration
    duration = (now - session.start_time).total_seconds()
    session.duration_seconds = max(1.0, duration)

    # Compute aggregate statistics
    participants = db.query(Participant).filter(Participant.session_id == session_id).all()
    total_blinks = sum(p.blink_count for p in participants)
    session.total_blinks = total_blinks

    top_blinker = None
    max_blinks = -1
    highest_rate = 0.0
    longest_streak = 0.0

    for p in participants:
        if p.blink_count > max_blinks:
            max_blinks = p.blink_count
            top_blinker = p.name
        if p.blink_rate > highest_rate:
            highest_rate = p.blink_rate
        if p.longest_streak > longest_streak:
            longest_streak = p.longest_streak

        # Update or create leaderboard entry
        entry = db.query(LeaderboardEntry).filter(
            LeaderboardEntry.session_id == session_id,
            LeaderboardEntry.participant_key == p.participant_key
        ).first()
        if not entry:
            entry = LeaderboardEntry(
                session_id=session_id,
                participant_name=p.name,
                participant_key=p.participant_key,
                color=p.color,
                total_blinks=p.blink_count,
                blink_rate=p.blink_rate,
                longest_streak=p.longest_streak
            )
            db.add(entry)
        else:
            entry.total_blinks = p.blink_count
            entry.blink_rate = p.blink_rate
            entry.longest_streak = p.longest_streak
            entry.updated_at = now

    # Achievements check
    unlocked_keys = []
    if total_blinks >= 1:
        unlocked_keys.append("FIRST_BLINK")
    if total_blinks >= 50:
        unlocked_keys.append("BLINK_CENTURION")
    if longest_streak >= 10.0:
        unlocked_keys.append("STARE_MASTER")
    if highest_rate >= 30.0:
        unlocked_keys.append("RAPID_FIRE")

    db.commit()

    report = SessionEndResponse(
        session_id=session.id,
        session_code=session.session_code,
        duration_seconds=session.duration_seconds,
        total_blinks=session.total_blinks,
        participants_count=len(participants),
        top_blinker=top_blinker,
        highest_rate_bpm=round(highest_rate, 1),
        longest_streak_sec=round(longest_streak, 1),
        achievements_unlocked=unlocked_keys
    )

    # Broadcast session conclusion
    await manager.broadcast(session_id, {
        "type": "SESSION_CONCLUDED",
        "report": report.model_dump()
    })

    return report
