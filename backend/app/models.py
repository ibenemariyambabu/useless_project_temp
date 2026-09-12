import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Text
)
from sqlalchemy.orm import relationship
from app.database import Base

def utcnow():
    return datetime.now(timezone.utc).replace(tzinfo=None)

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(64), unique=True, index=True, nullable=False)
    created_at = Column(DateTime, default=utcnow)

    sessions = relationship("Session", back_populates="user")
    achievements = relationship("AchievementRecord", back_populates="user")

class Session(Base):
    __tablename__ = "sessions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    session_code = Column(String(16), unique=True, index=True, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    mode = Column(String(32), default="standard")  # "standard", "battle", "race"
    start_time = Column(DateTime, default=utcnow)
    end_time = Column(DateTime, nullable=True)
    duration_seconds = Column(Float, default=0.0)
    total_blinks = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    metadata_json = Column(Text, nullable=True)

    user = relationship("User", back_populates="sessions")
    participants = relationship("Participant", back_populates="session", cascade="all, delete-orphan")
    blink_events = relationship("BlinkEvent", back_populates="session", cascade="all, delete-orphan")
    leaderboard_entries = relationship("LeaderboardEntry", back_populates="session", cascade="all, delete-orphan")
    achievements = relationship("AchievementRecord", back_populates="session")
    minigame_scores = relationship("MinigameScore", back_populates="session", cascade="all, delete-orphan")
    pet_states = relationship("PetState", back_populates="session", cascade="all, delete-orphan")
    reaction_events = relationship("ReactionEvent", back_populates="session", cascade="all, delete-orphan")

class Participant(Base):
    __tablename__ = "participants"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String(36), ForeignKey("sessions.id"), nullable=False)
    participant_key = Column(String(64), index=True, nullable=False)
    name = Column(String(64), default="Person")
    color = Column(String(32), default="#00FF9D")
    blink_count = Column(Integer, default=0)
    blink_rate = Column(Float, default=0.0)  # BPM
    current_streak = Column(Float, default=0.0)  # seconds
    longest_streak = Column(Float, default=0.0)
    baseline_ear = Column(Float, default=0.28)
    last_blink_time = Column(DateTime, nullable=True)
    last_seen = Column(DateTime, default=utcnow)
    is_active = Column(Boolean, default=True)

    session = relationship("Session", back_populates="participants")

class BlinkEvent(Base):
    __tablename__ = "blink_events"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String(36), ForeignKey("sessions.id"), nullable=False)
    participant_key = Column(String(64), index=True, nullable=False)
    timestamp = Column(Float, nullable=False)  # Client epoch ms
    duration_ms = Column(Float, nullable=False)
    ear_drop = Column(Float, nullable=False)
    min_ear = Column(Float, nullable=False)
    confidence = Column(Float, default=1.0)
    head_pose_yaw = Column(Float, default=0.0)
    head_pose_pitch = Column(Float, default=0.0)
    is_wink = Column(Boolean, default=False)
    wink_eye = Column(String(16), nullable=True)
    created_at = Column(DateTime, default=utcnow)

    session = relationship("Session", back_populates="blink_events")

class LeaderboardEntry(Base):
    __tablename__ = "leaderboard_entries"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String(36), ForeignKey("sessions.id"), nullable=True)
    participant_name = Column(String(64), index=True, nullable=False)
    participant_key = Column(String(64), nullable=False)
    color = Column(String(32), default="#00FF9D")
    total_blinks = Column(Integer, default=0)
    blink_rate = Column(Float, default=0.0)
    longest_streak = Column(Float, default=0.0)
    rank = Column(Integer, default=1)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)

    session = relationship("Session", back_populates="leaderboard_entries")

class AchievementRecord(Base):
    __tablename__ = "achievement_records"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    session_id = Column(String(36), ForeignKey("sessions.id"), nullable=True)
    achievement_key = Column(String(64), index=True, nullable=False)
    title = Column(String(128), nullable=False)
    description = Column(String(256), nullable=False)
    icon = Column(String(64), default="eye")
    unlocked_at = Column(DateTime, default=utcnow)

    user = relationship("User", back_populates="achievements")
    session = relationship("Session", back_populates="achievements")

class MinigameScore(Base):
    __tablename__ = "minigame_scores"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String(36), ForeignKey("sessions.id"), nullable=False)
    participant_name = Column(String(64), index=True, nullable=False)
    game_type = Column(String(32), index=True, default="rhythm")  # "rhythm", "race"
    score = Column(Integer, default=0)
    accuracy_pct = Column(Float, default=0.0)
    max_combo = Column(Integer, default=0)
    difficulty = Column(String(32), default="cyber")  # "casual", "cyber", "overclock"
    created_at = Column(DateTime, default=utcnow)

    session = relationship("Session", back_populates="minigame_scores")

class PetState(Base):
    __tablename__ = "pet_states"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String(36), ForeignKey("sessions.id"), unique=True, nullable=False)
    pet_name = Column(String(64), default="NEO-CYBER")
    species = Column(String(64), default="CYBER_FAMILIAR")
    level = Column(Integer, default=1)
    xp = Column(Integer, default=0)
    health = Column(Float, default=100.0)
    energy = Column(Float, default=100.0)
    happiness = Column(Float, default=100.0)
    evolution_stage = Column(String(32), default="EGG")  # "EGG", "SPRITE", "MECHA_FOX", "QUANTUM_DRAGON"
    total_blinks_fed = Column(Integer, default=0)
    avg_bpm = Column(Float, default=15.0)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)

    session = relationship("Session", back_populates="pet_states")

class ReactionEvent(Base):
    __tablename__ = "reaction_events"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String(36), ForeignKey("sessions.id"), nullable=False)
    participant_name = Column(String(64), nullable=False)
    combo_type = Column(String(64), nullable=False)  # "TRIPLE_BLINK", "DOUBLE_WINK_LEFT", etc.
    emoji = Column(String(16), default="🔥")
    title = Column(String(64), default="COMBO REACTION")
    timestamp = Column(Float, nullable=False)
    created_at = Column(DateTime, default=utcnow)

    session = relationship("Session", back_populates="reaction_events")
