import os
import logging
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from app.config import settings

logger = logging.getLogger("blinkos.database")

Base = declarative_base()

# Attempt connection to Postgres; fallback gracefully to SQLite for local standalone execution
db_url = settings.DATABASE_URL
engine = None

try:
    if db_url.startswith("sqlite"):
        engine = create_engine(db_url, connect_args={"check_same_thread": False})
        logger.info(f"Using SQLite database: {db_url}")
    else:
        # Try postgres with quick timeout check
        engine = create_engine(
            db_url, 
            pool_pre_ping=True, 
            connect_args={"connect_timeout": 3}
        )
        # Test connection
        with engine.connect() as conn:
            logger.info(f"Connected to PostgreSQL database: {db_url.split('@')[-1]}")
except Exception as exc:
    logger.warning(f"PostgreSQL connection failed ({exc}). Falling back to local SQLite ({settings.SQLITE_URL}).")
    engine = create_engine(settings.SQLITE_URL, connect_args={"check_same_thread": False})

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def init_db():
    """Create all database tables if they do not exist."""
    import app.models  # Ensure all models are registered with Base
    Base.metadata.create_all(bind=engine)
    logger.info("Database schema initialized successfully.")
