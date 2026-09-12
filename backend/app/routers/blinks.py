from datetime import datetime, timezone
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session as DBSession
from app.database import get_db
from app.models import Session, Participant, BlinkEvent, LeaderboardEntry
from app.schemas import BlinkEventCreate, BlinkEventResponse
from app.websocket import manager

router = APIRouter(prefix="/blinks", tags=["Blinks"])

def utcnow():
    return datetime.now(timezone.utc).replace(tzinfo=None)

@router.post("", response_model=BlinkEventResponse)
async def record_blink(payload: BlinkEventCreate, db: DBSession = Depends(get_db)):
    # 1. Verify session exists
    session = db.query(Session).filter(Session.id == payload.session_id).first()
    if not session:
        # Create session automatically if missing
        session = Session(
            id=payload.session_id,
            session_code="BLINK-LIVE",
            mode="standard",
            start_time=utcnow(),
            is_active=True,
            total_blinks=0
        )
        db.add(session)
        db.flush()

    # 2. Get or create participant
    participant = db.query(Participant).filter(
        Participant.session_id == payload.session_id,
        Participant.participant_key == payload.participant_key
    ).first()

    now = utcnow()

    if not participant:
        participant = Participant(
            session_id=payload.session_id,
            participant_key=payload.participant_key,
            name=payload.participant_key,
            color="#00FF9D",
            blink_count=1,
            blink_rate=1.0,
            current_streak=0.0,
            longest_streak=0.0,
            baseline_ear=payload.min_ear + payload.ear_drop,
            last_blink_time=now,
            last_seen=now,
            is_active=True
        )
        db.add(participant)
    else:
        # Calculate streak (time since last blink)
        if participant.last_blink_time:
            streak = (now - participant.last_blink_time).total_seconds()
            if streak > participant.longest_streak:
                participant.longest_streak = streak
            participant.current_streak = 0.0

        participant.blink_count += 1
        participant.last_blink_time = now
        participant.last_seen = now

        # Compute BPM
        session_elapsed_min = max(0.1, (now - session.start_time).total_seconds() / 60.0)
        participant.blink_rate = round(participant.blink_count / session_elapsed_min, 1)

    # 3. Increment session total blinks
    session.total_blinks += 1

    # 4. Insert BlinkEvent
    blink = BlinkEvent(
        session_id=payload.session_id,
        participant_key=payload.participant_key,
        timestamp=payload.timestamp,
        duration_ms=payload.duration_ms,
        ear_drop=payload.ear_drop,
        min_ear=payload.min_ear,
        confidence=payload.confidence,
        head_pose_yaw=payload.head_pose_yaw,
        head_pose_pitch=payload.head_pose_pitch,
        is_wink=payload.is_wink,
        wink_eye=payload.wink_eye,
        created_at=now
    )
    db.add(blink)

    # 5. Update Leaderboard Entry for this participant
    entry = db.query(LeaderboardEntry).filter(
        LeaderboardEntry.session_id == payload.session_id,
        LeaderboardEntry.participant_key == payload.participant_key
    ).first()

    if not entry:
        entry = LeaderboardEntry(
            session_id=payload.session_id,
            participant_name=participant.name,
            participant_key=participant.participant_key,
            color=participant.color,
            total_blinks=participant.blink_count,
            blink_rate=participant.blink_rate,
            longest_streak=participant.longest_streak
        )
        db.add(entry)
    else:
        entry.total_blinks = participant.blink_count
        entry.blink_rate = participant.blink_rate
        entry.longest_streak = max(entry.longest_streak, participant.longest_streak)
        entry.updated_at = now

    db.commit()
    db.refresh(blink)

    # 6. Broadcast live event via WebSocket room
    await manager.broadcast(payload.session_id, {
        "type": "BLINK_EVENT",
        "session_id": payload.session_id,
        "blink": {
            "participant_key": participant.participant_key,
            "name": participant.name,
            "color": participant.color,
            "duration_ms": blink.duration_ms,
            "ear_drop": blink.ear_drop,
            "confidence": blink.confidence,
            "is_wink": blink.is_wink,
            "wink_eye": blink.wink_eye,
            "blink_count": participant.blink_count,
            "blink_rate": participant.blink_rate,
            "timestamp": blink.timestamp
        }
    })

    return blink

@router.get("/{session_id}", response_model=List[BlinkEventResponse])
def get_session_blinks(session_id: str, limit: int = 100, db: DBSession = Depends(get_db)):
    events = (
        db.query(BlinkEvent)
        .filter(BlinkEvent.session_id == session_id)
        .order_by(BlinkEvent.id.desc())
        .limit(limit)
        .all()
    )
    return events
