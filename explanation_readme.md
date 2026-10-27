# Vartalaap – Technical Overview

> **Vartalaap** (`वर्तालाप` = *conversation*) is an open‑source AI meeting intelligence assistant that captures, transcribes, attributes speakers, and generates structured meeting summaries. This document explains the **technical architecture**, the **frontend**, the **backend**, the **database file structure**, the purpose of each key file, the overall data flow, and finally the **advantages & disadvantages** of the project.

---

## 1️⃣ Architecture at a Glance

```mermaid
flowchart LR
    subgraph Browser[Client (React)]
        UI[UI Components] -->|REST| API[FastAPI Backend]
        UI -->|Web Audio / MediaRecorder| Recorder[Audio Capture]
    end

    subgraph Backend[FastAPI Backend]
        API -->|POST audio| GroqTrans[Groq Whisper]
        API -->|GET data| DB[(SQLite DB)]
        API -->|POST summary| GroqSumm[Groq Llama 3.3‑70B]
    end

    subgraph Storage[Local Disk]
        RecordingsDir[recordings/ (audio files)] -.-> DB
    end

    Recorder -->|blob| RecordingsDir
    GroqTrans -->|verbose_json| DB
    GroqSumm -->|structured JSON| DB
    DB -->|segments, speakers| UI
    DB -->|summary| UI
```

*The system is **local‑first** – only the binary payload for transcription and the LLM request are sent to Groq Cloud.*

---

## 2️⃣ Frontend (React + Vite)

| Directory / File | Purpose | Key Exports | Important Links |
|-------------------|---------|-------------|-----------------|
| `src/App.jsx` | Root component, holds global state (active recording, health, modals) and orchestrates the workspace. | `App` (default) | [App.jsx](file:///c:/ROSP%20Project/Vartalaap/frontend/src/App.jsx) |
| `src/components/Header.jsx` | Top‑level header showing backend health and quick actions. | `Header` | [Header.jsx](file:///c:/ROSP%20Project/Vartalaap/frontend/src/components/Header.jsx) |
| `src/components/HeroWorkflow.jsx` | Intro screen with "Upload" / "Record" tabs. | `HeroWorkflow` | [HeroWorkflow.jsx](file:///c:/ROSP%20Project/Vartalaap/frontend/src/components/HeroWorkflow.jsx) |
| `src/components/AudioUploader.jsx` | Handles file upload, validates size (≤ 25 MB) and forwards to `POST /recordings`. | `AudioUploader` | [AudioUploader.jsx](file:///c:/ROSP%20Project/Vartalaap/frontend/src/components/AudioUploader.jsx) |
| `src/components/AudioRecorder.jsx` | Wraps the browser MediaRecorder API; streams microphone audio to the backend. | `AudioRecorder` | [AudioRecorder.jsx](file:///c:/ROSP%20Project/Vartalaap/frontend/src/components/AudioRecorder.jsx) |
| `src/components/AudioPlayer.jsx` | HTML5 `<audio>` player with seek callbacks used by transcript & summary panels. | `AudioPlayer` | [AudioPlayer.jsx](file:///c:/ROSP%20Project/Vartalaap/frontend/src/components/AudioPlayer.jsx) |
| `src/components/TranscriptView.jsx` | Lists transcription **segments**, shows speaker badges, allows assigning speakers to individual segments, and supports click‑to‑seek. | `TranscriptView` | [TranscriptView.jsx](file:///c:/ROSP%20Project/Vartalaap/frontend/src/components/TranscriptView.jsx) |
| `src/components/SummaryView.jsx` | Renders the structured JSON summary (title, bullet points, tasks, goals, decisions). Offers a *Regenerate* button and direct toggle to Chat. | `SummaryView` | [SummaryView.jsx](file:///c:/ROSP%20Project/Vartalaap/frontend/src/components/SummaryView.jsx) |
| `src/components/ChatWithMeeting.jsx` | Interactive RAG Chatbot UI with message bubbles, quick questions, audio jump timestamps, and strict grounding fallback. | `ChatWithMeeting` | [ChatWithMeeting.jsx](file:///c:/ROSP%20Project/Vartalaap/frontend/src/components/ChatWithMeeting.jsx) |
| `src/components/SpeakerManager.jsx` | CRUD UI for speakers (create, edit colour, delete). Updates the DB via the speakers router. | `SpeakerManager` | [SpeakerManager.jsx](file:///c:/ROSP%20Project/Vartalaap/frontend/src/components/SpeakerManager.jsx) |
| `src/components/RecordingsList.jsx` | Modal listing all recordings; selecting one loads its detail view. | `RecordingsList` | [RecordingsList.jsx](file:///c:/ROSP%20Project/Vartalaap/frontend/src/components/RecordingsList.jsx) |
| `src/api/client.js` | Thin wrapper around `fetch` exposing typed functions (`listRecordings`, `getRecordingDetail`, `summarizeRecording`, `chatWithMeeting`, etc.). | `api` object | [client.js](file:///c:/ROSP%20Project/Vartalaap/frontend/src/api/client.js) |

**State flow** – The UI calls `api.uploadRecording()` → backend creates a DB row (`status=uploaded`). A background task starts transcription. The UI polls `GET /recordings/{id}` to receive segment data, speaker assignments, and eventually the structured summary. Once completed, users can chat with the meeting via RAG.

---

## 3️⃣ Backend (FastAPI + Groq SDK + RAG Engine)

| File / Directory | Purpose | Core Functions / Classes | Consumed By |
|------------------|---------|--------------------------|-------------|
| `backend/app/main.py` | FastAPI app creation, CORS middleware, includes all routers including `rag.router`. | `app = FastAPI()` | Uvicorn server |
| `backend/app/config.py` | Loads `.env`, builds absolute paths (`PROJECT_ROOT`, `DATA_DIR`, `RECORDINGS_DIR`), defines the `Settings` dataclass with API keys, model names, limits, CORS origins, and RAG/embedding configs. | `settings = Settings()` | Every backend module |
| `backend/app/database.py` | SQLite helper (`get_db_connection`), schema creation (`init_db`), CRUD helpers for recordings, speakers, segments, summaries, and `meeting_embeddings`. | `create_recording_entry`, `save_segments_to_db`, `save_summary_entry`, `save_embeddings_for_recording`, `get_embeddings_for_recording`, query helpers | Routers, services |
| `backend/app/schemas.py` | Pydantic models that validate request/response bodies, structured summary schema (`StructuredSummaryData`), and RAG chat schemas (`ChatQueryRequest`, `ChatQueryResponse`, `ChatSourceChunk`). | `TranscriptSegment`, `Speaker`, `RecordingDetail`, `HealthStatus`, `StructuredSummaryData`, `ChatQueryRequest`, `ChatQueryResponse` | Routers, services |
| `backend/app/groq_service.py` | Thin wrapper around the Groq Python SDK. Handles **audio transcription** (`transcribe_audio_file`) and **LLM summarisation** (`summarize_conversation`). Includes retry/exponential back‑off and JSON‑repair fallback. | `transcribe_audio_file`, `summarize_conversation`, `GroqServiceException` | `recordings` and `summaries` routers |
| `backend/app/rag_service.py` | Retrieval-Augmented Generation engine. Chunks transcript segments, computes normalized embeddings (built-in semantic vectorizer or external API), calculates cosine similarity, and synthesizes strictly grounded answers via Groq LLM with exact fallback. | `chunk_segments`, `MeetingVectorizer`, `index_recording_transcript`, `retrieve_relevant_chunks`, `answer_question_with_rag` | `rag` router, `summaries` router |
| `backend/app/routers/recordings.py` | `POST /recordings` (upload), `GET /recordings/{id}` (detail), `DELETE /recordings/{id}`. Starts background transcription & auto-indexing after upload. | `upload_recording`, `get_recording_detail`, `delete_recording` | Frontend `api/client.js` |
| `backend/app/routers/speakers.py` | CRUD for speakers, and segment‑speaker assignment (`PATCH /recordings/{id}/segments/{seg_id}`). | `create_speaker`, `update_segment_speaker`, `batch_update_segments` | UI `SpeakerManager` & `TranscriptView` |
| `backend/app/routers/summaries.py` | `POST /recordings/{id}/summarize` – triggers LLM summarisation via `groq_service`. Automatically triggers transcript embedding indexing for RAG upon completion. | `summarize_recording` | UI `SummaryView` |
| `backend/app/routers/transcripts.py` | Retrieve transcript segments, update individual segments. | `list_segments`, `update_segment` | UI `TranscriptView` |
| `backend/app/routers/rag.py` | `POST /api/recordings/{id}/chat` (Q&A), `GET /api/recordings/{id}/chat/status` (index status), `POST /api/recordings/{id}/chat/index` (re-index). | `ask_meeting_question`, `get_chat_index_status`, `reindex_transcript` | Frontend `ChatWithMeeting` |
| `backend/app/routers/health.py` | Simple health endpoint exposing API key presence, model names, max file size, and masked key for debugging. | `get_health` | UI header health badge |

---

## 4️⃣ Database & On‑Disk Storage

| Table | Columns (key) | Description |
|-------|---------------|-------------|
| `recordings` | `id` (PK), `original_filename`, `file_path`, `file_size_bytes`, `mime_type`, `duration_seconds`, `status`, `error_message`, `created_at` | High‑level metadata for each audio file. Status flow: `uploaded → transcribing → transcribed → summarizing → completed`. |
| `speakers` | `id` (PK), `recording_id` (FK), `name`, `role`, `color`, `created_at` | Manual speaker entries; `color` drives UI badge styling. |
| `segments` | `id`, `recording_id` (FK), `start_time`, `end_time`, `text`, `speaker_id` (FK), `speaker_name`, `avg_logprob` | One row per Whisper segment; timestamps enable click‑to‑seek in the UI. |
| `summaries` | `id` (PK), `recording_id` (FK), `model_used`, `title`, `overall_summary`, `data_json`, `status`, `error_message`, `created_at` | Structured meeting summary stored as JSON (`data_json`). |
| `meeting_embeddings` | `id` (PK), `recording_id` (FK), `chunk_index`, `start_time`, `end_time`, `speaker_names`, `segment_ids`, `chunk_text`, `embedding`, `created_at` | Persisted transcript chunks and vectors for RAG retrieval. Indexed by `recording_id`. |

**Filesystem** – Audio files are stored under `backend/app/data/recordings/<recording-id>.wav` (or the original extension). The SQLite file lives at `backend/app/data/vartalaap.db`.

---

## 5️⃣ End‑to‑End Flow (User Story)

1. **User uploads or records audio** → `POST /recordings` (React component `AudioUploader` or `AudioRecorder`).
2. Backend stores the file, creates a DB entry with `status = uploaded`, and starts a background transcription task.
3. **Transcription** – Groq Whisper returns a `verbose_json` payload. The service normalises it into a list of segments and writes them to the `segments` table. Recording status becomes `transcribed`.
4. UI displays segments and speaker list, rendering the **Transcript View**.
5. User may **assign speakers** via the **Speaker Manager**; these updates are persisted in SQLite.
6. When **Generate Summary** completes, backend saves structured insights into `summaries` and the status flips to `completed`.
7. **Automatic RAG Indexing** – Transcript segments are chunked into overlapping conversational blocks, vector embeddings are generated, and persisted into `meeting_embeddings`.
8. **Chat with Meeting** – Users switch to the "Chat with Meeting" tab to ask questions.
9. **RAG Q&A Execution** – The backend generates the query vector, retrieves the top-k chunks using cosine similarity, and prompts the Groq LLM under strict grounding constraints.
10. **Strict Fallback Guarantee** – If information is not in the transcript, the chatbot returns: *"This information is not available in the meeting transcript."* Audio timestamps are hyperlinked for one-click audio playback.

---

## 6️⃣ Advantages & Disadvantages

### ✅ Advantages
- **Privacy‑first** – Audio stays on the local machine; only encrypted binaries are sent to Groq.
- **Strictly typed contracts** – Pydantic schemas guarantee well‑formed JSON, making downstream automation reliable.
- **Modular FastAPI routers** – Clear separation of concerns (recordings, speakers, summaries, health).
- **Extensible UI** – React component architecture makes adding new panels (e.g., sentiment analysis) straightforward.
- **Zero‑cost local UI** – No heavy front‑end framework overhead; vanilla CSS with a bespoke **Cream & Burgundy** design system provides a premium look.

### ⚠️ Disadvantages / Current Limitations
| Limitation | Impact | Mitigation / Future Work |
|------------|--------|--------------------------|
| **Dependency on Groq Cloud** | Latency & rate‑limit constraints; requires a valid API key. | Provide an optional local Whisper fallback or self‑hosted LLM alternative. |
| **No true live captioning** | Transcription occurs after the whole file is uploaded; not suitable for real‑time meeting notes. | Implement streaming transcription (WebSocket + Groq streaming API) or a local Whisper daemon. |
| **Single‑process background tasks** | `BackgroundTasks` share the Uvicorn worker; heavy concurrent uploads may block the server. | Move to a dedicated task queue (Celery + Redis) for horizontal scaling. |
| **Browser automation not yet integrated** | Current UI does not automatically join video‑conference calls; extending to Zoom/Teams would need fragile Playwright selectors. | Define a **BotAdapter** plugin interface, write integration tests per platform, and keep selectors versioned. |
| **Static CORS origins** | Hard‑coded in `config.py`; changes require code edits. | Load origins from an environment variable or a dedicated config file. |

### 🚀 Future Roadmap
1. **Streaming transcription** for live captioning.
2. **Task‑queue migration** (Celery or RQ) to improve concurrency.
3. **Plugin‑based meeting bots** for Zoom, Google Meet, Teams.
4. **WebSocket status updates** to replace UI polling.
5. **Encryption‑at‑rest** for stored audio files and optional multi‑user auth.

---

## 7️⃣ Quick Start Recap (for Developers)
1. `cp .env.example .env` → fill in `GROQ_API_KEY`.
2. **Backend**: `cd backend && python -m venv .venv && .\.venv\Scripts\activate && pip install -r requirements.txt && uvicorn app.main:app --reload --port 8000`.
3. **Frontend**: `cd frontend && npm install && npm run dev` → <http://localhost:5173>.
4. Open the UI, upload an audio file (≤ 25 MB) or record via microphone, wait for transcription, then generate the structured summary.

---

*Feel free to explore the code, open issues, or submit PRs. Enjoy turning meetings into actionable intelligence!*
