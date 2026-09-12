from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import PetState, Session as SessionModel
from app.schemas import PetStateUpdate, PetStateResponse
from app.websocket import manager

router = APIRouter(prefix="/pet", tags=["Cyber Pet Engine"])

@router.get("/{session_id}", response_model=PetStateResponse)
def get_or_create_pet(session_id: str, db: Session = Depends(get_db)):
    """Retrieve the digital cyber-pet state for this session, initializing one if absent."""
    sess = db.query(SessionModel).filter(SessionModel.id == session_id).first()
    if not sess:
        raise HTTPException(status_code=404, detail=f"Session '{session_id}' not found.")

    pet = db.query(PetState).filter(PetState.session_id == session_id).first()
    if not pet:
        pet = PetState(
            session_id=session_id,
            pet_name="NEO-CYBER",
            species="CYBER_FAMILIAR",
            level=1,
            xp=0,
            health=100.0,
            energy=100.0,
            happiness=100.0,
            evolution_stage="EGG",
            total_blinks_fed=0,
            avg_bpm=15.0
        )
        db.add(pet)
        db.commit()
        db.refresh(pet)

    return pet

@router.post("/{session_id}", response_model=PetStateResponse)
async def update_pet(session_id: str, pet_in: PetStateUpdate, db: Session = Depends(get_db)):
    """Update living metrics, evolution stage, and XP for the session's cyber pet."""
    sess = db.query(SessionModel).filter(SessionModel.id == session_id).first()
    if not sess:
        raise HTTPException(status_code=404, detail=f"Session '{session_id}' not found.")

    pet = db.query(PetState).filter(PetState.session_id == session_id).first()
    if not pet:
        pet = PetState(session_id=session_id)
        db.add(pet)

    if pet_in.pet_name is not None: pet.pet_name = pet_in.pet_name
    if pet_in.species is not None: pet.species = pet_in.species
    if pet_in.level is not None: pet.level = pet_in.level
    if pet_in.xp is not None: pet.xp = pet_in.xp
    if pet_in.health is not None: pet.health = max(0.0, min(100.0, pet_in.health))
    if pet_in.energy is not None: pet.energy = max(0.0, min(100.0, pet_in.energy))
    if pet_in.happiness is not None: pet.happiness = max(0.0, min(100.0, pet_in.happiness))
    if pet_in.evolution_stage is not None: pet.evolution_stage = pet_in.evolution_stage
    if pet_in.total_blinks_fed is not None: pet.total_blinks_fed = pet_in.total_blinks_fed
    if pet_in.avg_bpm is not None: pet.avg_bpm = pet_in.avg_bpm

    db.commit()
    db.refresh(pet)

    # Broadcast updated pet state to all room participants
    await manager.broadcast(session_id, {
        "type": "PET_UPDATE",
        "pet": {
            "name": pet.pet_name,
            "level": pet.level,
            "xp": pet.xp,
            "health": pet.health,
            "energy": pet.energy,
            "happiness": pet.happiness,
            "stage": pet.evolution_stage,
            "total_blinks_fed": pet.total_blinks_fed,
            "avg_bpm": pet.avg_bpm
        }
    })

    return pet
