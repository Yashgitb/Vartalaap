# Vartalaap — Groq-Powered Speech Transcription & Meeting Summarisation

Vartalaap is an executive-grade speech transcription and conversational intelligence system powered exclusively by **Groq Cloud AI APIs** using the official Python Groq SDK.

---

## Key Highlights

- **Ultra-Fast Speech Transcription**: Powered by `whisper-large-v3-turbo` on Groq Cloud LPUs with `verbose_json` segment timestamps.
- **Structured LLM Summarisation**: Powered by `llama-3.3-70b-versatile` (configurable via `GROQ_SUMMARY_MODEL`) with strict Pydantic JSON schema validation.
- **Audio-Transcript Synchronization**: Click any transcript segment or task reference tag to instantly jump the audio scrubber to that exact moment.
- **Manual Speaker Attribution**: Groq Whisper does not provide diarisation; Vartalaap keeps manual speaker creation and precise segment assignment to prevent hallucinated identities.
- **Robust Failure Isolation**: Transcripts and segment timestamps are safely committed to SQLite even if summarisation encounters an error, allowing easy one-click retries.
- **Strict Size & Format Validation**: Enforces Groq's 25MB upload limit and supported audio formats (`mp3`, `wav`, `m4a`, `webm`, `ogg`, `flac`, `aac`) before making remote calls.
- **Cream & Burgundy Reference UI**: Neo-brutalist editorial design system with sharp borders, solid offset drop shadows, serif typography, and status chips.

---

## Technology Stack

- **Frontend**: React (Vite), Vanilla CSS (Custom Cream & Burgundy Design System), Lucide Icons
- **Backend**: FastAPI, SQLite3, Official Python Groq SDK (`groq`), Pydantic v2
- **Audio Processing**: Web Audio API, MediaRecorder API, HTML5 Audio with range streaming
- **AI Models**:
  - Transcription: `whisper-large-v3-turbo`
  - Summarisation: `llama-3.3-70b-versatile` (or `llama-3.1-8b-instant`)

---

## Getting Started

### 1. Environment Configuration

Copy `.env.example` to `.env` in the project root:

```bash
cp .env.example .env
```

Edit `.env` and provide your Groq API key:

```env
GROQ_API_KEY=gsk_your_actual_groq_api_key
GROQ_TRANSCRIPTION_MODEL=whisper-large-v3-turbo
GROQ_SUMMARY_MODEL=llama-3.3-70b-versatile
MAX_FILE_SIZE_MB=25
```

### 2. Run the Backend Server

```bash
cd backend
python -m uvicorn app.main:app --reload --port 8000
```

FastAPI server runs on `http://127.0.0.1:8000` (API Docs at `http://127.0.0.1:8000/docs`).

### 3. Run the Frontend Development Server

```bash
cd frontend
npm run dev
```

Vite dev server runs on `http://localhost:5173`.

---

## External AI Processing Disclosure

All audio files and transcripts are transmitted to and processed by **Groq Cloud AI Services**. Your `GROQ_API_KEY` is maintained strictly on the backend and is never exposed to the client.
