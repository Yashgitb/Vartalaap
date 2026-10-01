import os
from pathlib import Path
from dotenv import load_dotenv

# Base paths
BACKEND_DIR = Path(__file__).resolve().parent.parent
PROJECT_ROOT = BACKEND_DIR.parent
DATA_DIR = BACKEND_DIR / "data"
RECORDINGS_DIR = DATA_DIR / "recordings"

# Ensure data directories exist
DATA_DIR.mkdir(parents=True, exist_ok=True)
RECORDINGS_DIR.mkdir(parents=True, exist_ok=True)

# Load environment variables from .env in Vartalaap root or backend
env_paths = [PROJECT_ROOT / ".env", BACKEND_DIR / ".env"]
for env_path in env_paths:
    if env_path.exists():
        load_dotenv(dotenv_path=env_path, override=True)
        break
else:
    load_dotenv(override=True)

class Settings:
    # Groq API Configuration (Backend-Only)
    GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "").strip()
    
    # Transcription Model - whisper-large-v3-turbo
    GROQ_TRANSCRIPTION_MODEL: str = os.getenv("GROQ_TRANSCRIPTION_MODEL", "whisper-large-v3-turbo").strip()
    
    # Summarisation Model - llama-3.3-70b-versatile
    GROQ_SUMMARY_MODEL: str = os.getenv("GROQ_SUMMARY_MODEL", "llama-3.3-70b-versatile").strip()
    
    # Upload limits (Groq limits audio files to 25 MB)
    MAX_FILE_SIZE_MB: int = int(os.getenv("MAX_FILE_SIZE_MB", "25"))
    MAX_FILE_SIZE_BYTES: int = MAX_FILE_SIZE_MB * 1024 * 1024
    
    ALLOWED_AUDIO_EXTENSIONS: set = {
        "mp3", "mp4", "mpeg", "mpga", "m4a", "wav", "webm", "ogg", "flac", "aac"
    }
    
    # Network and Retry Configuration
    REQUEST_TIMEOUT_SECONDS: float = float(os.getenv("REQUEST_TIMEOUT_SECONDS", "60.0"))
    MAX_RETRIES: int = int(os.getenv("MAX_RETRIES", "3"))
    RETRY_BACKOFF_FACTOR: float = float(os.getenv("RETRY_BACKOFF_FACTOR", "1.5"))
    
    # Server configuration
    HOST: str = os.getenv("HOST", "127.0.0.1")
    PORT: int = int(os.getenv("PORT", "8000"))
    CORS_ORIGINS: list[str] = [
        origin.strip() for origin in os.getenv("CORS_ORIGINS", "http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173,http://127.0.0.1:3000").split(",")
        if origin.strip()
    ]
    
    # Database
    DATABASE_PATH: str = str(DATA_DIR / "vartalaap.db")

settings = Settings()
