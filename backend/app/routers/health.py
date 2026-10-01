from fastapi import APIRouter
from ..config import settings
from ..schemas import HealthStatus

router = APIRouter(prefix="/api/health", tags=["Health & Status"])

@router.get("", response_model=HealthStatus)
def get_health_status():
    has_key = bool(settings.GROQ_API_KEY and len(settings.GROQ_API_KEY) > 5)
    masked_key = None
    if has_key:
        masked_key = f"{settings.GROQ_API_KEY[:6]}...{settings.GROQ_API_KEY[-4:]}"
    
    return HealthStatus(
        status="ok",
        has_groq_api_key=has_key,
        api_key_masked=masked_key,
        transcription_model=settings.GROQ_TRANSCRIPTION_MODEL,
        summary_model=settings.GROQ_SUMMARY_MODEL,
        max_file_size_mb=settings.MAX_FILE_SIZE_MB,
        external_ai_provider="Groq Cloud AI (groq-sdk)",
        provider_disclosure="Uploaded audio files and conversation transcripts are processed externally by Groq Cloud AI Services using whisper-large-v3-turbo and llama-3.3-70b-versatile. No keys or data are shared with unauthorized parties."
    )
