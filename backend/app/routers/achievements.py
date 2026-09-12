from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session as DBSession
from app.database import get_db
from app.models import AchievementRecord
from app.schemas import AchievementResponse, AchievementUnlock
from app.websocket import manager

router = APIRouter(prefix="/achievements", tags=["Achievements"])

AVAILABLE_ACHIEVEMENTS = [
    {
        "achievement_key": "FIRST_BLINK",
        "title": "First Contact",
        "description": "Recorded your very first authenticated optical blink.",
        "icon": "eye"
    },
    {
        "achievement_key": "STARE_MASTER",
        "title": "Stare Master",
        "description": "Maintained an unbroken stare for over 10 seconds without blinking.",
        "icon": "shield"
    },
    {
        "achievement_key": "RAPID_FIRE",
        "title": "Hyper Frequency",
        "description": "Surpassed 30 blinks per minute cadence in a single session.",
        "icon": "zap"
    },
    {
        "achievement_key": "BLINK_CENTURION",
        "title": "Blink Centurion",
        "description": "Accumulated 50 or more validated blinks.",
        "icon": "award"
    },
    {
        "achievement_key": "WINK_WARRIOR",
        "title": "Wink Protocol",
        "description": "Triggered a verified single-eye asymmetric ocular wink.",
        "icon": "smile"
    },
    {
        "achievement_key": "DUAL_PRESENCE",
        "title": "Multiplayer Engaged",
        "description": "Simultaneously tracked 2 or more independent human faces.",
        "icon": "users"
    }
]

def utcnow():
    return datetime.now(timezone.utc).replace(tzinfo=None)

@router.get("", response_model=List[dict])
def get_catalog():
    """Returns the full master catalog of BlinkOS achievements."""
    return AVAILABLE_ACHIEVEMENTS

@router.get("/session/{session_id}", response_model=List[AchievementResponse])
def get_session_achievements(session_id: str, db: DBSession = Depends(get_db)):
    """Returns all achievements unlocked for a specific session."""
    return (
        db.query(AchievementRecord)
        .filter(AchievementRecord.session_id == session_id)
        .all()
    )

@router.post("/unlock", response_model=AchievementResponse)
async def unlock_achievement(payload: AchievementUnlock, db: DBSession = Depends(get_db)):
    """Record an unlocked achievement and broadcast to session WebSocket clients."""
    # Check if already unlocked in this session
    existing = None
    if payload.session_id:
        existing = db.query(AchievementRecord).filter(
            AchievementRecord.session_id == payload.session_id,
            AchievementRecord.achievement_key == payload.achievement_key
        ).first()

    if not existing:
        record = AchievementRecord(
            session_id=payload.session_id,
            user_id=payload.user_id,
            achievement_key=payload.achievement_key,
            title=payload.title,
            description=payload.description,
            icon=payload.icon,
            unlocked_at=utcnow()
        )
        db.add(record)
        db.commit()
        db.refresh(record)
    else:
        record = existing

    # Broadcast celebration via WebSocket
    if payload.session_id:
        await manager.broadcast(payload.session_id, {
            "type": "ACHIEVEMENT_UNLOCKED",
            "achievement": {
                "key": record.achievement_key,
                "title": record.title,
                "description": record.description,
                "icon": record.icon,
                "unlocked_at": record.unlocked_at.isoformat()
            }
        })

    return record
