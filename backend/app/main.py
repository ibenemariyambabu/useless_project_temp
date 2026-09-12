import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.database import init_db, engine
from app.websocket import manager
from app.routers import sessions, blinks, leaderboard, achievements, battle, minigames, pet, reactions

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("blinkos.main")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Starting up BlinkOS Backend...")
    try:
        init_db()
        logger.info("Database initialized successfully.")
    except Exception as exc:
        logger.error(f"Failed to initialize database: {exc}")
    yield
    # Shutdown
    logger.info("Shutting down BlinkOS Backend...")

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Production-grade FastAPI backend for BlinkOS — Real-time computer-vision blink operating system.",
    lifespan=lifespan
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register REST Routers under /api
app.include_router(sessions.router, prefix="/api")
app.include_router(blinks.router, prefix="/api")
app.include_router(leaderboard.router, prefix="/api")
app.include_router(achievements.router, prefix="/api")
app.include_router(battle.router, prefix="/api")
app.include_router(minigames.router, prefix="/api")
app.include_router(pet.router, prefix="/api")
app.include_router(reactions.router, prefix="/api")

# WebSocket Endpoint for real-time multiplayer and session updates
@app.websocket("/ws/session/{session_id}")
async def session_websocket(websocket: WebSocket, session_id: str):
    await manager.connect(websocket, session_id)
    try:
        while True:
            data = await websocket.receive_json()
            msg_type = data.get("type", "UNKNOWN")
            
            if msg_type == "PING":
                await websocket.send_json({"type": "PONG", "timestamp": data.get("timestamp")})
            elif msg_type == "CHAT_MESSAGE":
                await manager.broadcast(session_id, {
                    "type": "CHAT_MESSAGE",
                    "sender": data.get("sender", "Anonymous"),
                    "text": data.get("text", ""),
                    "timestamp": data.get("timestamp")
                })
            elif msg_type == "BATTLE_TICK":
                await manager.broadcast(session_id, {
                    "type": "BATTLE_TICK",
                    "remaining": data.get("remaining"),
                    "scores": data.get("scores", {})
                })
            elif msg_type == "COMBO_REACTION":
                # Broadcast combo reaction (confetti burst + emoji floaters + audio) to all room peers
                await manager.broadcast(session_id, {
                    "type": "COMBO_REACTION",
                    "combo_type": data.get("combo_type", "TRIPLE_BLINK"),
                    "emoji": data.get("emoji", "🔥"),
                    "title": data.get("title", "COMBO REACTION"),
                    "participant_name": data.get("participant_name", "Anonymous"),
                    "timestamp": data.get("timestamp")
                })
            elif msg_type == "RHYTHM_SCORE_UPDATE":
                # Broadcast live rhythm game score & combo streak
                await manager.broadcast(session_id, {
                    "type": "RHYTHM_SCORE_UPDATE",
                    "participant_name": data.get("participant_name", "Anonymous"),
                    "score": data.get("score", 0),
                    "combo": data.get("combo", 0),
                    "accuracy": data.get("accuracy", "PERFECT")
                })
            elif msg_type == "PET_UPDATE":
                # Relay living cyber-pet vital stats & evolution to all clients
                await manager.broadcast(session_id, {
                    "type": "PET_UPDATE",
                    "pet": data.get("pet", {})
                })
            elif msg_type == "COMBO_STREAK":
                # Broadcast rapid arcade combo streak & announcer event
                await manager.broadcast(session_id, {
                    "type": "COMBO_STREAK",
                    "streak_data": data.get("streak_data", {})
                })
            else:
                # Echo / relay to room
                await manager.broadcast(session_id, data)
    except WebSocketDisconnect:
        manager.disconnect(websocket, session_id)
        await manager.broadcast(session_id, {
            "type": "CLIENT_DISCONNECTED",
            "session_id": session_id
        })
    except Exception as exc:
        logger.warning(f"WebSocket error: {exc}")
        manager.disconnect(websocket, session_id)

@app.get("/")
def root():
    return {
        "service": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "status": "operational",
        "docs_url": "/docs",
        "health_url": "/api/health"
    }

@app.get("/api/health")
def healthcheck():
    db_connected = False
    try:
        with engine.connect() as conn:
            db_connected = True
    except Exception:
        db_connected = False

    return {
        "status": "healthy" if db_connected else "degraded",
        "service": "blinkos-backend",
        "version": settings.APP_VERSION,
        "database": {
            "connected": db_connected,
            "engine": str(engine.url).split("://")[0]
        },
        "active_rooms": len(manager.active_rooms)
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host=settings.HOST, port=settings.PORT, reload=settings.DEBUG)
