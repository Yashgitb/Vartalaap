import json
import math
import re
import logging
from typing import List, Dict, Any, Tuple, Optional
from datetime import datetime
import httpx

from .config import settings
from .database import (
    get_recording_entry,
    get_segments_by_recording,
    get_speakers_by_recording,
    get_embeddings_for_recording,
    save_embeddings_for_recording,
    count_embeddings_for_recording,
    delete_embeddings_for_recording
)
from .groq_service import get_groq_client, execute_with_retry, GroqServiceException
from .schemas import ChatSourceChunk, ChatQueryResponse

logger = logging.getLogger("vartalaap.rag")

# Mandatory exact fallback string specified by user requirements
FALLBACK_RESPONSE = "This information is not available in the meeting transcript."

# --- Chunking Helper ---

def chunk_segments(
    segments: List[Dict[str, Any]],
    speaker_map: Dict[str, str],
    target_chunk_size: int = 3,
    overlap: int = 1
) -> List[Dict[str, Any]]:
    """
    Split sequential transcript segments into meaningful overlapping chunks.
    Preserves start/end timestamps, speaker names, and segment IDs.
    """
    if not segments:
        return []

    chunks = []
    total_segs = len(segments)

    # For very short transcripts (<= 3 segments), treat each segment as a chunk
    if total_segs <= 3:
        for idx, seg in enumerate(segments):
            speaker_name = seg.get("speaker_name") or speaker_map.get(seg.get("speaker_id") or "", "Unknown Speaker")
            start = round(float(seg.get("start", 0.0)), 2)
            end = round(float(seg.get("end", 0.0)), 2)
            formatted_text = f"[{format_timestamp(start)} - {format_timestamp(end)}] {speaker_name}: {seg.get('text', '').strip()}"
            chunks.append({
                "chunk_index": idx,
                "start_time": start,
                "end_time": end,
                "speaker_names": [speaker_name] if speaker_name else [],
                "segment_ids": [seg.get("id", idx)],
                "chunk_text": formatted_text,
            })
        return chunks

    # Sliding window chunking
    step = max(1, target_chunk_size - overlap)
    chunk_idx = 0

    for i in range(0, total_segs, step):
        window = segments[i : i + target_chunk_size]
        if not window:
            break

        start_time = round(float(window[0].get("start", 0.0)), 2)
        end_time = round(float(window[-1].get("end", 0.0)), 2)

        speakers_in_chunk = []
        text_lines = []
        seg_ids = []

        for s in window:
            sid = s.get("id")
            if sid is not None and sid not in seg_ids:
                seg_ids.append(sid)

            s_name = s.get("speaker_name") or speaker_map.get(s.get("speaker_id") or "", "Unknown Speaker")
            if s_name and s_name not in speakers_in_chunk and s_name != "Unknown Speaker":
                speakers_in_chunk.append(s_name)

            s_start = round(float(s.get("start", 0.0)), 2)
            s_end = round(float(s.get("end", 0.0)), 2)
            text_lines.append(f"[{format_timestamp(s_start)} - {format_timestamp(s_end)}] {s_name}: {s.get('text', '').strip()}")

        combined_text = "\n".join(text_lines)
        chunks.append({
            "chunk_index": chunk_idx,
            "start_time": start_time,
            "end_time": end_time,
            "speaker_names": speakers_in_chunk,
            "segment_ids": seg_ids,
            "chunk_text": combined_text,
        })
        chunk_idx += 1

        # Break if the window reached the end of transcript
        if i + target_chunk_size >= total_segs:
            break

    return chunks

def format_timestamp(seconds: float) -> str:
    """Format seconds into MM:SS string."""
    m = int(seconds // 60)
    s = int(seconds % 60)
    return f"{m:02d}:{s:02d}"


# --- Embeddings Engine (Local Vectorizer + API Fallback) ---

def tokenize_for_embedding(text: str) -> List[str]:
    """Tokenize text into lowercase words and character n-grams for semantic matching."""
    text_clean = text.lower()
    words = re.findall(r'\b[a-z0-9_]+\b', text_clean)
    tokens = list(words)
    # Add character n-grams (3-5 chars) for subword matching (e.g., numbers, prefixes)
    for w in words:
        if len(w) >= 3:
            for n in (3, 4):
                if len(w) >= n:
                    for j in range(len(w) - n + 1):
                        tokens.append(w[j : j + n])
    return tokens


class MeetingVectorizer:
    """
    Self-contained semantic vectorizer using TF-IDF and character n-grams.
    Generates normalized dense embedding vectors for chunks and queries.
    Provides fast, reproducible, offline-ready embeddings without torch overhead.
    """
    def __init__(self, vocabulary: Optional[List[str]] = None, idf: Optional[Dict[str, float]] = None):
        self.vocab: List[str] = vocabulary or []
        self.vocab_map: Dict[str, int] = {term: idx for idx, term in enumerate(self.vocab)}
        self.idf: Dict[str, float] = idf or {}

    def fit(self, texts: List[str]):
        doc_count = len(texts)
        if doc_count == 0:
            return

        term_doc_freq: Dict[str, int] = {}
        for text in texts:
            unique_terms = set(tokenize_for_embedding(text))
            for t in unique_terms:
                term_doc_freq[t] = term_doc_freq.get(t, 0) + 1

        # Keep terms appearing at least once
        sorted_terms = sorted(term_doc_freq.keys())
        self.vocab = sorted_terms
        self.vocab_map = {t: idx for idx, t in enumerate(sorted_terms)}

        # Standard smooth IDF formula: ln((1 + N) / (1 + df)) + 1
        self.idf = {
            t: math.log((doc_count + 1.0) / (df + 1.0)) + 1.0
            for t, df in term_doc_freq.items()
        }

    def transform(self, text: str) -> List[float]:
        """Convert a text string to an L2-normalized vector."""
        if not self.vocab:
            return []

        tokens = tokenize_for_embedding(text)
        if not tokens:
            return [0.0] * len(self.vocab)

        vec = [0.0] * len(self.vocab)
        term_counts: Dict[str, int] = {}
        for t in tokens:
            term_counts[t] = term_counts.get(t, 0) + 1

        total_tokens = len(tokens)
        for t, count in term_counts.items():
            if t in self.vocab_map:
                idx = self.vocab_map[t]
                tf = count / total_tokens
                idf_val = self.idf.get(t, 1.0)
                vec[idx] = tf * idf_val

        # L2 Normalize
        norm = math.sqrt(sum(x * x for x in vec))
        if norm > 0.0:
            vec = [round(x / norm, 6) for x in vec]
        return vec


def generate_external_embeddings(texts: List[str]) -> List[List[float]]:
    """
    Call an external OpenAI-compatible embedding API if configured.
    Falls back gracefully if the endpoint returns an error or key is missing.
    """
    api_key = settings.EMBEDDING_API_KEY
    base_url = settings.EMBEDDING_BASE_URL.rstrip("/")
    model = settings.EMBEDDING_MODEL

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    payload = {
        "input": texts,
        "model": model
    }

    with httpx.Client(timeout=30.0) as client:
        resp = client.post(f"{base_url}/embeddings", json=payload, headers=headers)
        resp.raise_for_status()
        data = resp.json()
        embeddings = [item["embedding"] for item in data.get("data", [])]
        return embeddings


def compute_cosine_similarity(vec_a: List[float], vec_b: List[float]) -> float:
    """Calculate cosine similarity between two numeric vectors."""
    if not vec_a or not vec_b:
        return 0.0
    if len(vec_a) != len(vec_b):
        min_len = min(len(vec_a), len(vec_b))
        vec_a = vec_a[:min_len]
        vec_b = vec_b[:min_len]

    dot = sum(a * b for a, b in zip(vec_a, vec_b))
    norm_a = math.sqrt(sum(a * a for a in vec_a))
    norm_b = math.sqrt(sum(b * b for b in vec_b))
    if norm_a == 0.0 or norm_b == 0.0:
        return 0.0
    return round(dot / (norm_a * norm_b), 4)


# --- Core RAG Indexing & Storage ---

def index_recording_transcript(recording_id: str, force_reindex: bool = False) -> List[Dict[str, Any]]:
    """
    Index a recording's transcript:
    1. Read segments from database.
    2. Group segments into overlapping chunks.
    3. Generate embeddings for chunks.
    4. Persist to meeting_embeddings table in SQLite.
    Returns the indexed chunks.
    """
    existing_count = count_embeddings_for_recording(recording_id)
    if existing_count > 0 and not force_reindex:
        logger.info("Recording %s is already indexed (%d chunks). Reusing persisted embeddings.", recording_id, existing_count)
        return get_embeddings_for_recording(recording_id)

    segments = get_segments_by_recording(recording_id)
    if not segments:
        logger.warning("No segments found for recording %s to index.", recording_id)
        return []

    speakers = get_speakers_by_recording(recording_id)
    speaker_map = {s["id"]: s["name"] for s in speakers if "id" in s and "name" in s}

    # 1. Chunk segments
    raw_chunks = chunk_segments(segments, speaker_map)
    if not raw_chunks:
        return []

    chunk_texts = [c["chunk_text"] for c in raw_chunks]

    # 2. Generate embeddings
    embeddings: List[List[float]] = []
    used_external = False

    if settings.EMBEDDING_API_KEY and settings.EMBEDDING_PROVIDER != "local":
        try:
            logger.info("Generating embeddings for %s using external API (%s)...", recording_id, settings.EMBEDDING_MODEL)
            embeddings = generate_external_embeddings(chunk_texts)
            used_external = True
        except Exception as e:
            logger.warning("External embedding API failed for %s (%s). Falling back to built-in semantic vectorizer.", recording_id, str(e))
            used_external = False

    if not used_external or not embeddings:
        logger.info("Indexing %d chunks for recording %s with built-in semantic vectorizer...", len(raw_chunks), recording_id)
        vectorizer = MeetingVectorizer()
        vectorizer.fit(chunk_texts)
        embeddings = [vectorizer.transform(t) for t in chunk_texts]

    # 3. Attach embeddings to chunks
    for idx, c in enumerate(raw_chunks):
        c["embedding"] = embeddings[idx] if idx < len(embeddings) else []

    # 4. Save to database
    save_embeddings_for_recording(recording_id, raw_chunks)
    logger.info("Successfully indexed recording %s with %d chunks.", recording_id, len(raw_chunks))
    return raw_chunks


def retrieve_relevant_chunks(
    recording_id: str,
    question: str,
    top_k: Optional[int] = None
) -> List[Dict[str, Any]]:
    """
    Retrieve top-k most relevant chunks for a question against a specific recording.
    Maintains strict meeting-specific isolation.
    """
    k = top_k or settings.RAG_TOP_K

    # Ensure embeddings exist
    chunks = get_embeddings_for_recording(recording_id)
    if not chunks:
        chunks = index_recording_transcript(recording_id)

    if not chunks:
        return []

    # Generate question embedding
    question_vec: List[float] = []
    used_external = False

    if settings.EMBEDDING_API_KEY and settings.EMBEDDING_PROVIDER != "local":
        try:
            res = generate_external_embeddings([question])
            if res:
                question_vec = res[0]
                used_external = True
        except Exception as e:
            logger.warning("External embedding query failed (%s). Falling back to local vectorizer.", str(e))
            used_external = False

    if not used_external or not question_vec:
        # Fit vectorizer on existing chunk texts to maintain identical vector space
        chunk_texts = [c["chunk_text"] for c in chunks]
        vectorizer = MeetingVectorizer()
        vectorizer.fit(chunk_texts)
        question_vec = vectorizer.transform(question)

    # Compute similarity scores
    scored_chunks = []
    for c in chunks:
        sim = compute_cosine_similarity(question_vec, c.get("embedding", []))
        scored_chunks.append({
            **c,
            "similarity": sim
        })

    # Sort descending by similarity
    scored_chunks.sort(key=lambda x: x["similarity"], reverse=True)
    return scored_chunks[:k]


# --- Answer Generation with Strict Grounding ---

def answer_question_with_rag(
    recording_id: str,
    question: str,
    top_k: Optional[int] = None
) -> ChatQueryResponse:
    """
    Executes the complete RAG pipeline:
    1. Retrieve relevant transcript chunks.
    2. Check relevance threshold.
    3. Pass chunks and question to LLM with strict grounding instructions.
    4. Enforce exact fallback if answer is not in transcript.
    """
    rec = get_recording_entry(recording_id)
    if not rec:
        raise GroqServiceException(f"Recording {recording_id} not found.", status_code=404)

    # Clean question
    clean_question = question.strip()
    if not clean_question:
        return ChatQueryResponse(
            answer=FALLBACK_RESPONSE,
            sources=[],
            is_fallback=True,
            recording_id=recording_id
        )

    # 1. Retrieve relevant chunks
    retrieved = retrieve_relevant_chunks(recording_id, clean_question, top_k=top_k)

    if not retrieved:
        logger.info("No chunks found for recording %s. Returning fallback.", recording_id)
        return ChatQueryResponse(
            answer=FALLBACK_RESPONSE,
            sources=[],
            is_fallback=True,
            recording_id=recording_id
        )

    # Format sources for response
    sources = [
        ChatSourceChunk(
            chunk_index=c["chunk_index"],
            start_time=c["start_time"],
            end_time=c["end_time"],
            speaker_names=c.get("speaker_names", []),
            segment_ids=c.get("segment_ids", []),
            text=c.get("chunk_text", ""),
            similarity=round(c.get("similarity", 0.0), 4)
        )
        for c in retrieved
    ]

    # Check top similarity against threshold
    max_similarity = max([s.similarity for s in sources]) if sources else 0.0
    if max_similarity < settings.RAG_SIMILARITY_THRESHOLD:
        logger.info(
            "Max chunk similarity (%.4f) below threshold (%.4f) for question '%s'. Returning fallback.",
            max_similarity, settings.RAG_SIMILARITY_THRESHOLD, clean_question
        )
        return ChatQueryResponse(
            answer=FALLBACK_RESPONSE,
            sources=sources,
            is_fallback=True,
            recording_id=recording_id
        )

    # Format transcript excerpts for prompt
    context_blocks = []
    for s in sources:
        spk_label = ", ".join(s.speaker_names) if s.speaker_names else "Participants"
        context_blocks.append(
            f"--- [Excerpt #{s.chunk_index} | Time: {format_timestamp(s.start_time)} - {format_timestamp(s.end_time)} | Speakers: {spk_label}] ---\n"
            f"{s.text}\n"
        )
    context_str = "\n".join(context_blocks)

    # Strict System Prompt
    system_prompt = f"""You are the official Vartalaap AI Meeting Chatbot for this specific meeting.
Your duty is to answer questions EXCLUSIVELY and STRICTLY using the provided meeting transcript excerpts below.

STRUCTURE & FORMATTING RULES:
1. SIMPLE & NEATLY STRUCTURED:
   - Deliver clear, direct, and simply worded answers.
   - Do NOT include conversational filler or preambles (avoid 'Based on the provided excerpts...', 'In the meeting...', etc.). State the answer directly.
   - For multi-part answers or list of items, format using clean, short bullet points.
   - Bold key names, actions, or topics for readability (e.g., "**Topic / Action:** Detail").
   - Keep sentences short, crisp, and to the point.
2. CITATIONS:
   - Always append the speaker and audio timestamp at the end of each bullet or relevant sentence (e.g., `[00:10 - 00:16] Rohan Verma`).
3. EXCLUSIVE SOURCE OF TRUTH:
   - The provided transcript excerpts are your ONLY source of truth.
   - Do NOT use any external knowledge, assumptions, or unmentioned facts.
   - Do NOT guess, extrapolate, or hallucinate.
4. STRICT FALLBACK REQUIREMENT:
   - If the answer cannot be found in the provided transcript excerpts, or if the retrieved excerpts are insufficient, or if the question is unrelated to the meeting, you MUST respond with EXACTLY this sentence and nothing else:
"{FALLBACK_RESPONSE}"
5. ISOLATION:
   - Never refer to any other meeting or external context.
"""

    user_prompt = f"""MEETING TRANSCRIPT EXCERPTS:
{context_str}

USER QUESTION:
{clean_question}

Provide a simple, neatly structured answer citing timestamps and speakers, or respond with EXACTLY: "{FALLBACK_RESPONSE}"."""

    client = get_groq_client()
    model = settings.RAG_CHAT_MODEL or settings.GROQ_SUMMARY_MODEL
    logger.info("Executing RAG answer generation for recording %s with model '%s'...", recording_id, model)

    def _call_llm():
        return client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            temperature=0.0,
            max_tokens=600
        )

    try:
        completion = execute_with_retry(f"RAG Chat Completion ({model})", _call_llm)
        raw_answer = completion.choices[0].message.content.strip()

        # Check if LLM signaled fallback or missing information
        normalized = raw_answer.strip().strip('"').strip("'").strip().lower()
        fallback_normalized = FALLBACK_RESPONSE.lower()

        if (
            fallback_normalized in normalized
            or "not available in the meeting transcript" in normalized
            or "not mentioned in the transcript" in normalized
            or "not mentioned in the meeting" in normalized
            or "is not discussed in the transcript" in normalized
            or "not discussed in the provided" in normalized
            or "cannot be answered" in normalized
        ):
            final_answer = FALLBACK_RESPONSE
            is_fallback = True
        else:
            final_answer = raw_answer
            is_fallback = False

        return ChatQueryResponse(
            answer=final_answer,
            sources=sources,
            model_used=model,
            is_fallback=is_fallback,
            recording_id=recording_id
        )

    except GroqServiceException as e:
        logger.error("Groq RAG LLM call failed: %s", e.message)
        raise
    except Exception as e:
        logger.error("Unexpected error in RAG LLM generation: %s", str(e), exc_info=True)
        raise GroqServiceException(
            message=f"Failed to generate answer from meeting transcript: {str(e)}",
            status_code=500
        )
