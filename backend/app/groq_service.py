import os
import json
import time
import random
import logging
from typing import List, Dict, Any, Optional, Tuple
from pathlib import Path
from groq import Groq, APIConnectionError, RateLimitError, APIStatusError, AuthenticationError, BadRequestError
from pydantic import ValidationError

from .config import settings
from .schemas import StructuredSummaryData, TranscriptSegment

logger = logging.getLogger("vartalaap.groq_service")

class GroqServiceException(Exception):
    """Custom exception for Groq Service errors with user-friendly messages and status codes."""
    def __init__(self, message: str, status_code: int = 500, details: Optional[Dict[str, Any]] = None):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.details = details or {}

def get_groq_client() -> Groq:
    """Instantiate and return the Groq SDK client with backend GROQ_API_KEY and timeout."""
    api_key = settings.GROQ_API_KEY
    if not api_key:
        raise GroqServiceException(
            message="Groq API Key is not configured. Please set GROQ_API_KEY in your .env file.",
            status_code=401,
            details={"resolution": "Add GROQ_API_KEY=gsk_... to your .env file and restart the server."}
        )
    return Groq(
        api_key=api_key,
        timeout=settings.REQUEST_TIMEOUT_SECONDS,
        max_retries=0  # We implement custom bounded retries with informative logging & jitter
    )

def execute_with_retry(operation_name: str, func, *args, **kwargs):
    """Execute a callable with bounded retries, exponential backoff, and jitter."""
    max_retries = settings.MAX_RETRIES
    backoff = settings.RETRY_BACKOFF_FACTOR
    
    last_error = None
    for attempt in range(1, max_retries + 1):
        try:
            return func(*args, **kwargs)
        except AuthenticationError as e:
            logger.error("Groq Authentication Error on %s: %s", operation_name, str(e))
            raise GroqServiceException(
                message="Invalid Groq API Key. Please verify your GROQ_API_KEY in .env.",
                status_code=401,
                details={"error_type": "AuthenticationError", "original": str(e)}
            )
        except BadRequestError as e:
            logger.error("Groq Bad Request Error on %s: %s", operation_name, str(e))
            raise GroqServiceException(
                message=f"Groq API Request Error: {str(e)}",
                status_code=400,
                details={"error_type": "BadRequestError", "original": str(e)}
            )
        except RateLimitError as e:
            last_error = e
            wait_time = (backoff ** attempt) + random.uniform(0.5, 1.5)
            logger.warning(
                "Groq Rate Limit hit (HTTP 429) during %s on attempt %d/%d. Waiting %.2fs...",
                operation_name, attempt, max_retries, wait_time
            )
            if attempt < max_retries:
                time.sleep(wait_time)
            else:
                raise GroqServiceException(
                    message="Groq API Rate Limit reached (HTTP 429). Please wait a moment and try again.",
                    status_code=429,
                    details={"error_type": "RateLimitError", "attempts": attempt, "original": str(e)}
                )
        except APIConnectionError as e:
            last_error = e
            wait_time = (backoff ** attempt) + random.uniform(0.5, 1.0)
            logger.warning(
                "Groq Connection Error during %s on attempt %d/%d: %s. Retrying in %.2fs...",
                operation_name, attempt, max_retries, str(e), wait_time
            )
            if attempt < max_retries:
                time.sleep(wait_time)
            else:
                raise GroqServiceException(
                    message="Network error connecting to Groq Cloud API. Please check your internet connection.",
                    status_code=503,
                    details={"error_type": "APIConnectionError", "original": str(e)}
                )
        except APIStatusError as e:
            last_error = e
            if e.status_code in [500, 502, 503, 504] and attempt < max_retries:
                wait_time = (backoff ** attempt) + 1.0
                logger.warning("Groq Server Error %d during %s. Retrying in %.2fs...", e.status_code, operation_name, wait_time)
                time.sleep(wait_time)
            else:
                raise GroqServiceException(
                    message=f"Groq Cloud API Error (HTTP {e.status_code}): {e.message}",
                    status_code=e.status_code,
                    details={"error_type": "APIStatusError", "status_code": e.status_code}
                )
        except Exception as e:
            logger.error("Unexpected error during %s: %s", operation_name, str(e), exc_info=True)
            raise GroqServiceException(
                message=f"Unexpected error during {operation_name}: {str(e)}",
                status_code=500,
                details={"original": str(e)}
            )

    raise GroqServiceException(
        message=f"Failed to complete {operation_name} after {max_retries} attempts: {str(last_error)}",
        status_code=500
    )


def transcribe_audio_file(file_path: str, prompt: Optional[str] = None) -> Tuple[List[Dict[str, Any]], float, str]:
    """
    Transcribe audio file using Groq Whisper (whisper-large-v3-turbo).
    Validates file size against 25MB Groq limit.
    Requests verbose_json format to extract segment-level timestamps and IDs.
    Returns (segments, total_duration, full_text).
    """
    path = Path(file_path)
    if not path.exists():
        raise GroqServiceException(f"Audio file not found at {file_path}", status_code=404)
    
    file_size = path.stat().st_size
    if file_size > settings.MAX_FILE_SIZE_BYTES:
        size_mb = file_size / (1024 * 1024)
        raise GroqServiceException(
            message=f"File size ({size_mb:.2f} MB) exceeds Groq limit of {settings.MAX_FILE_SIZE_MB} MB. Please upload a smaller audio file.",
            status_code=413,
            details={"file_size_bytes": file_size, "max_size_bytes": settings.MAX_FILE_SIZE_BYTES}
        )
    
    # Check extension
    ext = path.suffix.lstrip(".").lower()
    if ext not in settings.ALLOWED_AUDIO_EXTENSIONS:
        raise GroqServiceException(
            message=f"Unsupported audio format '.{ext}'. Supported formats: {', '.join(settings.ALLOWED_AUDIO_EXTENSIONS)}",
            status_code=400
        )
    
    client = get_groq_client()
    model = settings.GROQ_TRANSCRIPTION_MODEL
    logger.info("Transcribing '%s' (%d bytes) using Groq model '%s'...", path.name, file_size, model)

    def _call_transcription():
        with open(file_path, "rb") as audio_file:
            # We pass filename tuple so Groq recognizes mime type
            file_tuple = (path.name, audio_file.read())
            kwargs = {
                "file": file_tuple,
                "model": model,
                "response_format": "verbose_json",
                "temperature": 0.0,
            }
            if prompt:
                kwargs["prompt"] = prompt
            return client.audio.transcriptions.create(**kwargs)

    raw_response = execute_with_retry(f"Groq Transcription ({model})", _call_transcription)
    
    # Parse verbose_json response
    # raw_response is a TranscriptionVerbose object with .text, .duration, .segments
    full_text = getattr(raw_response, "text", "") or ""
    duration = getattr(raw_response, "duration", 0.0) or 0.0
    raw_segments = getattr(raw_response, "segments", []) or []
    
    parsed_segments = []
    for idx, seg in enumerate(raw_segments):
        # seg can be dict or pydantic model
        if hasattr(seg, "start"):
            s_start = float(seg.start)
            s_end = float(seg.end)
            s_text = str(seg.text or "").strip()
            s_id = int(getattr(seg, "id", idx))
            s_logprob = getattr(seg, "avg_logprob", None)
        elif isinstance(seg, dict):
            s_start = float(seg.get("start", 0.0))
            s_end = float(seg.get("end", 0.0))
            s_text = str(seg.get("text", "")).strip()
            s_id = int(seg.get("id", idx))
            s_logprob = seg.get("avg_logprob")
        else:
            continue
        
        # Whisper segment ID preservation
        parsed_segments.append({
            "id": s_id,
            "start": round(s_start, 2),
            "end": round(s_end, 2),
            "text": s_text,
            "speaker_id": None,
            "speaker_name": None,
            "avg_logprob": s_logprob
        })

    # Fallback if no segments returned but text is present
    if not parsed_segments and full_text.strip():
        parsed_segments.append({
            "id": 0,
            "start": 0.0,
            "end": round(duration or 1.0, 2),
            "text": full_text.strip(),
            "speaker_id": None,
            "speaker_name": None,
            "avg_logprob": None
        })

    # Calculate duration if not provided
    if duration <= 0.0 and parsed_segments:
        duration = max([s["end"] for s in parsed_segments])

    logger.info("Transcription completed: %d segments, %.2f seconds", len(parsed_segments), duration)
    return parsed_segments, duration, full_text


def summarize_conversation(
    segments: List[Dict[str, Any]],
    speakers: List[Dict[str, Any]],
    custom_instructions: Optional[str] = None,
    override_model: Optional[str] = None
) -> StructuredSummaryData:
    """
    Generate structured meeting summary using Groq LLM (llama-3.3-70b-versatile).
    Extracts overall summary, person-wise summaries, goals, tasks with owners and deadlines,
    and references supporting transcript segment IDs.
    Validates output strictly with Pydantic.
    """
    if not segments:
        raise GroqServiceException("Cannot summarize an empty transcript.", status_code=400)
    
    client = get_groq_client()
    model = override_model or settings.GROQ_SUMMARY_MODEL
    
    # Build speaker directory reference
    speaker_map = {s["id"]: s["name"] for s in speakers if "id" in s and "name" in s}
    known_speakers = list(set(s["name"] for s in speakers if "name" in s and s["name"].strip()))
    
    # Build transcript text with segment IDs and speaker labels
    formatted_lines = []
    for s in segments:
        seg_id = s.get("id", 0)
        start = s.get("start", 0.0)
        end = s.get("end", 0.0)
        speaker_name = s.get("speaker_name")
        if not speaker_name and s.get("speaker_id") in speaker_map:
            speaker_name = speaker_map[s["speaker_id"]]
        
        label = speaker_name if speaker_name else "Unassigned Speaker"
        formatted_lines.append(f"[Segment #{seg_id} | {start:.1f}s - {end:.1f}s] {label}: {s.get('text', '').strip()}")
    
    transcript_block = "\n".join(formatted_lines)
    
    # Define system prompt with strict structured output rules
    system_prompt = f"""You are an elite executive AI meeting analyst.
Your task is to analyze the conversation transcript provided and generate a highly structured, accurate, and comprehensive meeting summary in JSON format.

CRITICAL RULES FOR SPEAKER ATTRIBUTION & DATA INTEGRITY:
1. NEVER INVENT OR HALLUCINATE SPEAKER IDENTITIES:
   - If speakers have names labeled in the transcript (e.g. from user assignment: {json.dumps(known_speakers)}), use those exact names.
   - If speakers are labeled as "Unassigned Speaker" or not named, refer to them neutrally as "Participant" or "Speaker" or based on their exact role in the text. NEVER make up fictional names like 'Alice' or 'Bob'.
2. SUPPORTING SEGMENT IDS:
   - For every single task, goal, person contribution, and decision, cite the exact list of integer segment IDs (e.g. [0, 2, 4]) from the transcript that directly mention or support that item.
3. STRUCTURED SCHEMA:
   You MUST return a valid JSON object matching this exact schema:
   {{
     "title": "Concise and descriptive title of the meeting / discussion",
     "overall_summary": "Thorough executive summary highlighting the background, core discussion points, and general outcome.",
     "key_discussion_points": [
       "Bullet point summarizing topic 1",
       "Bullet point summarizing topic 2"
     ],
     "person_summaries": [
       {{
         "speaker_name": "Name of speaker or 'Participant 1'",
         "role": "Role or area of focus if evident, or null",
         "summary": "Synthesis of this person's perspective, proposals, or contributions",
         "key_contributions": ["Key point 1", "Key point 2"],
         "supporting_segment_ids": [0, 1]
       }}
     ],
     "goals": [
       {{
         "id": "goal_1",
         "goal": "Core objective or target agreed upon",
         "status": "planned" | "in_progress" | "achieved",
         "supporting_segment_ids": [1, 3]
       }}
     ],
     "tasks": [
       {{
         "id": "task_1",
         "action": "Actionable task description",
         "owner": "Name of assignee or 'Unassigned'",
         "deadline": "Due date / timeframe or 'Not specified'",
         "priority": "high" | "medium" | "low",
         "supporting_segment_ids": [2, 5],
         "completed": false
       }}
     ],
     "decisions": [
       {{
         "id": "dec_1",
         "decision": "Agreed decision or policy",
         "rationale": "Reason or context for this decision",
         "supporting_segment_ids": [4]
       }}
     ]
   }}
"""
    
    user_prompt = f"""TRANSCRIPT TO ANALYZE:
---
{transcript_block}
---

{f'ADDITIONAL USER INSTRUCTIONS: {custom_instructions}' if custom_instructions else ''}

Please generate the complete structured JSON analysis conforming to the schema."""

    logger.info("Requesting structured summarisation using Groq LLM '%s'...", model)
    
    def _call_llm():
        return client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            response_format={"type": "json_object"},
            temperature=0.2,
        )

    completion = execute_with_retry(f"Groq Summarisation ({model})", _call_llm)
    
    raw_content = completion.choices[0].message.content
    logger.debug("Raw Groq LLM response: %s", raw_content[:200])
    
    try:
        data_dict = json.loads(raw_content)
    except json.JSONDecodeError as e:
        logger.error("Failed to parse Groq LLM output as JSON: %s\nContent: %s", str(e), raw_content)
        raise GroqServiceException(
            message="Groq LLM returned malformed JSON. Please retry summarisation.",
            status_code=502,
            details={"raw_response": raw_content[:500]}
        )
    
    try:
        structured_summary = StructuredSummaryData.model_validate(data_dict)
        structured_summary.model_used = model
        structured_summary.generated_at = time.strftime("%Y-%m-%d %H:%M:%S")
        structured_summary.external_provider = "Groq Cloud AI (Official SDK)"
        return structured_summary
    except ValidationError as e:
        logger.error("Pydantic validation failed on Groq summary data: %s", str(e))
        # Attempt comprehensive repair for LLMs that use alternate key names
        try:
            # --- Resolve alternate key names for top-level fields ---
            raw_tasks = (
                data_dict.get("tasks")
                or data_dict.get("action_items")
                or data_dict.get("action_items_tasks")
                or data_dict.get("actionItems")
                or data_dict.get("items")
                or []
            )
            raw_decisions = (
                data_dict.get("decisions")
                or data_dict.get("key_decisions")
                or data_dict.get("keyDecisions")
                or []
            )
            raw_goals = (
                data_dict.get("goals")
                or data_dict.get("objectives")
                or data_dict.get("key_goals")
                or []
            )
            raw_persons = (
                data_dict.get("person_summaries")
                or data_dict.get("participant_summaries")
                or data_dict.get("speaker_summaries")
                or data_dict.get("participants")
                or []
            )
            raw_discussion = (
                data_dict.get("key_discussion_points")
                or data_dict.get("discussion_points")
                or data_dict.get("key_points")
                or data_dict.get("keyPoints")
                or []
            )

            # --- Normalize tasks: map alternate field names ---
            normalized_tasks = []
            for idx, t in enumerate(raw_tasks):
                if not isinstance(t, dict):
                    continue
                normalized_tasks.append({
                    "id": t.get("id", t.get("task_id", f"task_{idx + 1}")),
                    "action": t.get("action", t.get("task", t.get("description", t.get("title", "No description")))),
                    "owner": t.get("owner", t.get("assignee", t.get("assigned_to", "Unassigned"))),
                    "deadline": t.get("deadline", t.get("due_date", t.get("timeframe", "Not specified"))),
                    "priority": t.get("priority", "medium"),
                    "supporting_segment_ids": t.get("supporting_segment_ids", t.get("segment_ids", t.get("segments", []))),
                    "completed": t.get("completed", False),
                })

            # --- Normalize decisions ---
            normalized_decisions = []
            for idx, d in enumerate(raw_decisions):
                if not isinstance(d, dict):
                    continue
                normalized_decisions.append({
                    "id": d.get("id", d.get("decision_id", f"dec_{idx + 1}")),
                    "decision": d.get("decision", d.get("description", d.get("title", "No description"))),
                    "rationale": d.get("rationale", d.get("reasoning", d.get("context", ""))),
                    "supporting_segment_ids": d.get("supporting_segment_ids", d.get("segment_ids", d.get("segments", []))),
                })

            # --- Normalize goals ---
            normalized_goals = []
            for idx, g in enumerate(raw_goals):
                if not isinstance(g, dict):
                    continue
                normalized_goals.append({
                    "id": g.get("id", g.get("goal_id", f"goal_{idx + 1}")),
                    "goal": g.get("goal", g.get("objective", g.get("description", g.get("title", "No description")))),
                    "status": g.get("status", "planned"),
                    "supporting_segment_ids": g.get("supporting_segment_ids", g.get("segment_ids", g.get("segments", []))),
                })

            # --- Normalize person summaries ---
            normalized_persons = []
            for p in raw_persons:
                if not isinstance(p, dict):
                    continue
                normalized_persons.append({
                    "speaker_name": p.get("speaker_name", p.get("name", p.get("participant", "Unknown Speaker"))),
                    "role": p.get("role"),
                    "summary": p.get("summary", p.get("contribution_summary", p.get("description", ""))),
                    "key_contributions": p.get("key_contributions", p.get("contributions", p.get("key_points", []))),
                    "supporting_segment_ids": p.get("supporting_segment_ids", p.get("segment_ids", p.get("segments", []))),
                })

            repaired = {
                "title": data_dict.get("title", data_dict.get("meeting_title", "Conversation Summary")),
                "overall_summary": data_dict.get("overall_summary", data_dict.get("summary", data_dict.get("executive_summary", "Summary not available"))),
                "key_discussion_points": raw_discussion,
                "person_summaries": normalized_persons,
                "goals": normalized_goals,
                "tasks": normalized_tasks,
                "decisions": normalized_decisions,
                "model_used": model,
                "generated_at": time.strftime("%Y-%m-%d %H:%M:%S"),
                "external_provider": "Groq Cloud AI"
            }
            logger.info("Repaired summary data — tasks: %d, decisions: %d, goals: %d", len(normalized_tasks), len(normalized_decisions), len(normalized_goals))
            return StructuredSummaryData.model_validate(repaired)
        except Exception as retry_err:
            raise GroqServiceException(
                message=f"Summarisation output schema validation failed: {str(e)}",
                status_code=502,
                details={"validation_errors": e.errors()}
            )
