import sqlite3
import json
import logging
from datetime import datetime
from typing import List, Dict, Any, Optional
from .config import settings

logger = logging.getLogger("vartalaap.database")

def get_db_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(settings.DATABASE_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # 1. Recordings Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS recordings (
        id TEXT PRIMARY KEY,
        original_filename TEXT NOT NULL,
        file_path TEXT NOT NULL,
        file_size_bytes INTEGER NOT NULL,
        mime_type TEXT,
        duration_seconds REAL DEFAULT 0.0,
        status TEXT NOT NULL DEFAULT 'uploaded', -- uploaded, transcribing, transcribed, summarizing, completed, error
        error_message TEXT,
        created_at TEXT NOT NULL
    );
    """)
    
    # 2. Speakers Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS speakers (
        id TEXT PRIMARY KEY,
        recording_id TEXT NOT NULL,
        name TEXT NOT NULL,
        role TEXT,
        color TEXT NOT NULL DEFAULT '#8B2635',
        created_at TEXT NOT NULL,
        FOREIGN KEY (recording_id) REFERENCES recordings (id) ON DELETE CASCADE
    );
    """)
    
    # 3. Segments Table (preserves exact Whisper timestamps and segment index)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS segments (
        id INTEGER NOT NULL,
        recording_id TEXT NOT NULL,
        start_time REAL NOT NULL,
        end_time REAL NOT NULL,
        text TEXT NOT NULL,
        speaker_id TEXT,
        speaker_name TEXT,
        avg_logprob REAL,
        PRIMARY KEY (recording_id, id),
        FOREIGN KEY (recording_id) REFERENCES recordings (id) ON DELETE CASCADE,
        FOREIGN KEY (speaker_id) REFERENCES speakers (id) ON DELETE SET NULL
    );
    """)
    
    # 4. Summaries Table (preserves structured JSON data and generation status)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS summaries (
        id TEXT PRIMARY KEY,
        recording_id TEXT NOT NULL UNIQUE,
        model_used TEXT NOT NULL,
        title TEXT NOT NULL,
        overall_summary TEXT NOT NULL,
        data_json TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'completed', -- completed, failed
        error_message TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (recording_id) REFERENCES recordings (id) ON DELETE CASCADE
    );
    """)
    
    conn.commit()
    conn.close()
    logger.info("SQLite Database initialized successfully at %s", settings.DATABASE_PATH)

# --- Recordings Helpers ---

def create_recording_entry(
    rec_id: str,
    original_filename: str,
    file_path: str,
    file_size_bytes: int,
    mime_type: str = "audio/mpeg"
) -> Dict[str, Any]:
    conn = get_db_connection()
    cursor = conn.cursor()
    now = datetime.now().isoformat()
    cursor.execute(
        """
        INSERT INTO recordings (id, original_filename, file_path, file_size_bytes, mime_type, status, created_at)
        VALUES (?, ?, ?, ?, ?, 'uploaded', ?)
        """,
        (rec_id, original_filename, file_path, file_size_bytes, mime_type, now)
    )
    conn.commit()
    conn.close()
    return {
        "id": rec_id,
        "original_filename": original_filename,
        "file_size_bytes": file_size_bytes,
        "duration_seconds": 0.0,
        "status": "uploaded",
        "created_at": now
    }

def update_recording_status(
    recording_id: str,
    status: str,
    error_message: Optional[str] = None,
    duration_seconds: Optional[float] = None
):
    conn = get_db_connection()
    cursor = conn.cursor()
    if duration_seconds is not None:
        cursor.execute(
            "UPDATE recordings SET status = ?, error_message = ?, duration_seconds = ? WHERE id = ?",
            (status, error_message, duration_seconds, recording_id)
        )
    else:
        cursor.execute(
            "UPDATE recordings SET status = ?, error_message = ? WHERE id = ?",
            (status, error_message, recording_id)
        )
    conn.commit()
    conn.close()

def get_recording_entry(recording_id: str) -> Optional[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM recordings WHERE id = ?", (recording_id,))
    row = cursor.fetchone()
    conn.close()
    if not row:
        return None
    return dict(row)

def list_all_recordings() -> List[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM recordings ORDER BY created_at DESC")
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

def delete_recording_entry(recording_id: str) -> bool:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM summaries WHERE recording_id = ?", (recording_id,))
    cursor.execute("DELETE FROM segments WHERE recording_id = ?", (recording_id,))
    cursor.execute("DELETE FROM speakers WHERE recording_id = ?", (recording_id,))
    cursor.execute("DELETE FROM recordings WHERE id = ?", (recording_id,))
    deleted = cursor.rowcount > 0
    conn.commit()
    conn.close()
    return deleted

# --- Segments Helpers ---

def save_segments_to_db(recording_id: str, segments: List[Dict[str, Any]]):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM segments WHERE recording_id = ?", (recording_id,))
    for seg in segments:
        cursor.execute(
            """
            INSERT INTO segments (id, recording_id, start_time, end_time, text, speaker_id, speaker_name, avg_logprob)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                seg["id"],
                recording_id,
                seg["start"],
                seg["end"],
                seg["text"].strip(),
                seg.get("speaker_id"),
                seg.get("speaker_name"),
                seg.get("avg_logprob")
            )
        )
    conn.commit()
    conn.close()

def get_segments_by_recording(recording_id: str) -> List[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT * FROM segments WHERE recording_id = ? ORDER BY id ASC",
        (recording_id,)
    )
    rows = cursor.fetchall()
    conn.close()
    results = []
    for r in rows:
        results.append({
            "id": r["id"],
            "start": r["start_time"],
            "end": r["end_time"],
            "text": r["text"],
            "speaker_id": r["speaker_id"],
            "speaker_name": r["speaker_name"],
            "avg_logprob": r["avg_logprob"]
        })
    return results

def update_single_segment_speaker(recording_id: str, segment_id: int, speaker_id: Optional[str], speaker_name: Optional[str]):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "UPDATE segments SET speaker_id = ?, speaker_name = ? WHERE recording_id = ? AND id = ?",
        (speaker_id, speaker_name, recording_id, segment_id)
    )
    conn.commit()
    conn.close()

def batch_update_segments_speaker(recording_id: str, segment_ids: List[int], speaker_id: Optional[str], speaker_name: Optional[str]):
    conn = get_db_connection()
    cursor = conn.cursor()
    for sid in segment_ids:
        cursor.execute(
            "UPDATE segments SET speaker_id = ?, speaker_name = ? WHERE recording_id = ? AND id = ?",
            (speaker_id, speaker_name, recording_id, sid)
        )
    conn.commit()
    conn.close()

# --- Speakers Helpers ---

def create_speaker_entry(recording_id: str, speaker_id: str, name: str, role: Optional[str], color: str) -> Dict[str, Any]:
    conn = get_db_connection()
    cursor = conn.cursor()
    now = datetime.now().isoformat()
    cursor.execute(
        """
        INSERT INTO speakers (id, recording_id, name, role, color, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (speaker_id, recording_id, name, role, color, now)
    )
    conn.commit()
    conn.close()
    return {
        "id": speaker_id,
        "recording_id": recording_id,
        "name": name,
        "role": role,
        "color": color,
        "created_at": now
    }

def get_speakers_by_recording(recording_id: str) -> List[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT * FROM speakers WHERE recording_id = ? ORDER BY created_at ASC",
        (recording_id,)
    )
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

def delete_speaker_entry(recording_id: str, speaker_id: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    # Reset speaker on assigned segments
    cursor.execute(
        "UPDATE segments SET speaker_id = NULL, speaker_name = NULL WHERE recording_id = ? AND speaker_id = ?",
        (recording_id, speaker_id)
    )
    cursor.execute(
        "DELETE FROM speakers WHERE recording_id = ? AND id = ?",
        (recording_id, speaker_id)
    )
    conn.commit()
    conn.close()

# --- Summaries Helpers ---

def save_summary_entry(
    recording_id: str,
    summary_id: str,
    model_used: str,
    title: str,
    overall_summary: str,
    data_dict: Dict[str, Any],
    status: str = "completed",
    error_message: Optional[str] = None
):
    conn = get_db_connection()
    cursor = conn.cursor()
    now = datetime.now().isoformat()
    cursor.execute(
        """
        INSERT OR REPLACE INTO summaries (id, recording_id, model_used, title, overall_summary, data_json, status, error_message, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            summary_id,
            recording_id,
            model_used,
            title,
            overall_summary,
            json.dumps(data_dict),
            status,
            error_message,
            now
        )
    )
    conn.commit()
    conn.close()

def get_summary_by_recording(recording_id: str) -> Optional[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM summaries WHERE recording_id = ?", (recording_id,))
    row = cursor.fetchone()
    conn.close()
    if not row:
        return None
    res = dict(row)
    try:
        res["data"] = json.loads(res["data_json"])
    except Exception:
        res["data"] = {}
    return res
