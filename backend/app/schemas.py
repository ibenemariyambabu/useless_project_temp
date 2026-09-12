from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field

# --- Blink Event Schemas ---

class BlinkEventCreate(BaseModel):
    session_id: str
    participant_key: str = Field(..., description="e.g. 'PERSON 1'")
    timestamp: float = Field(..., description="Epoch ms timestamp")
    duration_ms: float = Field(..., ge=0, description="Duration in ms")
    ear_drop: float = Field(..., description="Drop from baseline EAR")
    min_ear: float = Field(..., description="Lowest EAR during blink")
    confidence: float = Field(1.0, ge=0.0, le=1.0)
    head_pose_yaw: float = 0.0
    head_pose_pitch: float = 0.0
    is_wink: bool = False
    wink_eye: Optional[str] = None

class BlinkEventResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    session_id: str
    participant_key: str
    timestamp: float
    duration_ms: float
    ear_drop: float
    min_ear: float
    confidence: float
    is_wink: bool
    wink_eye: Optional[str] = None
    created_at: datetime

# --- Participant Schemas ---

class ParticipantCreate(BaseModel):
    participant_key: str
    name: str = "Person"
    color: str = "#00FF9D"
    baseline_ear: float = 0.28

class ParticipantUpdate(BaseModel):
    name: Optional[str] = None
    color: Optional[str] = None
    blink_count: Optional[int] = None
    blink_rate: Optional[float] = None
    current_streak: Optional[float] = None
    longest_streak: Optional[float] = None
    baseline_ear: Optional[float] = None
    is_active: Optional[bool] = None

class ParticipantResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    session_id: str
    participant_key: str
    name: str
    color: str
    blink_count: int
    blink_rate: float
    current_streak: float
    longest_streak: float
    baseline_ear: float
    last_seen: datetime
    is_active: bool

# --- Session Schemas ---

class SessionCreate(BaseModel):
    mode: str = "standard"  # "standard", "battle", "race"
    session_code: Optional[str] = None
    user_id: Optional[int] = None

class SessionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    session_code: str
    mode: str
    start_time: datetime
    end_time: Optional[datetime] = None
    duration_seconds: float
    total_blinks: int
    is_active: bool
    participants: List[ParticipantResponse] = []

class SessionEndResponse(BaseModel):
    session_id: str
    session_code: str
    duration_seconds: float
    total_blinks: int
    participants_count: int
    top_blinker: Optional[str] = None
    highest_rate_bpm: float = 0.0
    longest_streak_sec: float = 0.0
    achievements_unlocked: List[str] = []

# --- Leaderboard Schemas ---

class LeaderboardEntryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    session_id: Optional[str] = None
    participant_name: str
    participant_key: str
    color: str
    total_blinks: int
    blink_rate: float
    longest_streak: float
    rank: int
    updated_at: datetime

# --- Achievement Schemas ---

class AchievementUnlock(BaseModel):
    session_id: Optional[str] = None
    user_id: Optional[int] = None
    achievement_key: str
    title: str
    description: str
    icon: str = "eye"

class AchievementResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    achievement_key: str
    title: str
    description: str
    icon: str
    unlocked_at: datetime

# --- Battle & Multiplayer Action Schemas ---

class BattleAction(BaseModel):
    action: str = Field(..., description="'start', 'pause', 'reset', 'tick'")
    duration: int = Field(30, description="Round duration in seconds")
    scores: Optional[dict] = None

# --- Minigame Score Schemas ---

class MinigameScoreCreate(BaseModel):
    session_id: str
    participant_name: str
    game_type: str = "rhythm"  # "rhythm", "race"
    score: int
    accuracy_pct: float = 0.0
    max_combo: int = 0
    difficulty: str = "cyber"

class MinigameScoreResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    session_id: str
    participant_name: str
    game_type: str
    score: int
    accuracy_pct: float
    max_combo: int
    difficulty: str
    created_at: datetime

# --- Cyber Pet Schemas ---

class PetStateUpdate(BaseModel):
    pet_name: Optional[str] = "NEO-CYBER"
    species: Optional[str] = "CYBER_FAMILIAR"
    level: Optional[int] = 1
    xp: Optional[int] = 0
    health: Optional[float] = 100.0
    energy: Optional[float] = 100.0
    happiness: Optional[float] = 100.0
    evolution_stage: Optional[str] = "EGG"
    total_blinks_fed: Optional[int] = 0
    avg_bpm: Optional[float] = 15.0

class PetStateResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    session_id: str
    pet_name: str
    species: str
    level: int
    xp: int
    health: float
    energy: float
    happiness: float
    evolution_stage: str
    total_blinks_fed: int
    avg_bpm: float
    updated_at: datetime

# --- Reaction & Combo Schemas ---

class ReactionEventCreate(BaseModel):
    session_id: str
    participant_name: str
    combo_type: str
    emoji: str = "🔥"
    title: str = "COMBO REACTION"
    timestamp: float

class ReactionEventResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    session_id: str
    participant_name: str
    combo_type: str
    emoji: str
    title: str
    timestamp: float
    created_at: datetime

