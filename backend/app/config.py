import os
from typing import List
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    APP_NAME: str = "BlinkOS Backend"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True
    
    # Primary Postgres URL from environment or Docker
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL", 
        "postgresql://blinkos:blinkos_secret@localhost:5432/blinkos"
    )
    # Automatic fallback SQLite URL for zero-friction standalone local dev
    SQLITE_URL: str = "sqlite:///./blinkos.db"
    
    # CORS
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5500",
        "http://127.0.0.1:5500",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        "*"
    ]
    
    # Server host & port
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    
    # Session defaults
    DEFAULT_ROUND_DURATION: int = 30  # seconds

    class Config:
        env_file = ".env"
        extra = "allow"

settings = Settings()
