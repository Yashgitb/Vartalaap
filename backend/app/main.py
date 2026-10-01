import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .config import settings
from .database import init_db
from .groq_service import GroqServiceException
from .routers import health, recordings, transcripts, summaries, speakers

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("vartalaap")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize SQLite database on startup
    init_db()
    logger.info("Vartalaap Backend started with Groq AI integration.")
    logger.info("Transcription Model: %s", settings.GROQ_TRANSCRIPTION_MODEL)
    logger.info("Summary Model: %s", settings.GROQ_SUMMARY_MODEL)
    logger.info("Max Upload Limit: %d MB", settings.MAX_FILE_SIZE_MB)
    yield
    logger.info("Vartalaap Backend shutting down.")

app = FastAPI(
    title="Vartalaap - Speech Transcription & Meeting Summarisation API",
    description="Groq-powered Speech Transcription (Whisper Large v3 Turbo) and LLM Summarisation (Llama 3.3 70B)",
    version="2.0.0",
    lifespan=lifespan
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Exception handlers
@app.exception_handler(GroqServiceException)
async def groq_service_exception_handler(request: Request, exc: GroqServiceException):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": True,
            "message": exc.message,
            "details": exc.details
        }
    )

# Include Routers
app.include_router(health.router)
app.include_router(recordings.router)
app.include_router(transcripts.router)
app.include_router(summaries.router)
app.include_router(speakers.router)

@app.get("/")
def root():
    return {
        "name": "Vartalaap API",
        "status": "online",
        "provider": "Groq Cloud AI",
        "docs": "/docs"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host=settings.HOST, port=settings.PORT, reload=True)
