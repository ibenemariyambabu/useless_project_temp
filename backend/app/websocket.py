import json
import logging
from typing import Dict, Set
from fastapi import WebSocket

logger = logging.getLogger("blinkos.websocket")

class ConnectionManager:
    def __init__(self):
        # Map session_id -> Set of active WebSockets
        self.active_rooms: Dict[str, Set[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, session_id: str):
        await websocket.accept()
        if session_id not in self.active_rooms:
            self.active_rooms[session_id] = set()
        self.active_rooms[session_id].add(websocket)
        logger.info(f"Client connected to session '{session_id}'. Total in room: {len(self.active_rooms[session_id])}")
        
        # Send welcome message
        await websocket.send_json({
            "type": "CONNECTION_ESTABLISHED",
            "session_id": session_id,
            "clients_count": len(self.active_rooms[session_id])
        })

    def disconnect(self, websocket: WebSocket, session_id: str):
        if session_id in self.active_rooms:
            self.active_rooms[session_id].discard(websocket)
            if not self.active_rooms[session_id]:
                del self.active_rooms[session_id]
            logger.info(f"Client disconnected from session '{session_id}'.")

    async def broadcast(self, session_id: str, message: dict):
        """Broadcast a message to all clients connected to a specific session room."""
        if session_id not in self.active_rooms:
            return
        
        dead_sockets = set()
        for websocket in self.active_rooms[session_id]:
            try:
                await websocket.send_json(message)
            except Exception as exc:
                logger.warning(f"Error sending message to websocket: {exc}")
                dead_sockets.add(websocket)
        
        for dead in dead_sockets:
            self.active_rooms[session_id].discard(dead)

    async def broadcast_all(self, message: dict):
        """Broadcast to every connected client across all rooms."""
        for session_id in list(self.active_rooms.keys()):
            await self.broadcast(session_id, message)

manager = ConnectionManager()
