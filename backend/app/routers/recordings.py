import os
import uuid
import logging
from pathlib import Path
from typing import List, Optional
from fastapi import APIRouter, UploadFile, File, HTTPException, BackgroundTasks, status
from fastapi.responses import FileResponse

from ..config import settings, RECORDINGS_DIR
from ..database import (
    create_recording_entry,
    get_recording_entry,
    list_all_recordings,
    delete_recording_entry,
    get_segments_by_recording,
    get_speakers_by_recording,
    get_summary_by_recording,
    update_recording_status
)
from ..schemas import RecordingBase, RecordingDetail
from ..groq_service import transcribe_audio_file, summarize_conversation, GroqServiceException

logger = logging.getLogger("vartalaap.recordings")
router = APIRouter(prefix="/api/recordings", tags=["Recordings"])

@router.post("/upload", response_model=RecordingDetail)
async def upload_audio(
    file: UploadFile = File(...),
    auto_transcribe: bool = True,
    auto_summarize: bool = True
):
    """
    Upload an audio file for Vartalaap processing.
    Validates against Groq 25MB limits and supported extensions.
    Optionally starts transcription immediately.
    """
    filename = file.filename or "recording.wav"
    ext = filename.split(".")[-1].lower() if "." in filename else ""
    
    if ext not in settings.ALLOWED_AUDIO_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file format '.{ext}'. Supported formats: {', '.join(sorted(settings.ALLOWED_AUDIO_EXTENSIONS))}"
        )

    # Generate unique ID and save path
    rec_id = f"rec_{uuid.uuid4().hex[:12]}"
    saved_filename = f"{rec_id}_{filename}"
    file_path = RECORDINGS_DIR / saved_filename
    
    # Stream and count bytes to enforce 25MB limit
    total_bytes = 0
    try:
        with open(file_path, "wb") as buffer:
            while chunk := await file.read(1024 * 1024):  # 1MB chunks
                total_bytes += len(chunk)
                if total_bytes > settings.MAX_FILE_SIZE_BYTES:
                    buffer.close()
                    if file_path.exists():
                        file_path.unlink()
                    raise HTTPException(
                        status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                        detail=f"Audio file size exceeds the Groq 25MB limit ({total_bytes / (1024*1024):.2f}MB). Please upload a smaller recording."
                    )
                buffer.write(chunk)
    except HTTPException:
        raise
    except Exception as e:
        if file_path.exists():
            file_path.unlink()
        logger.error("Failed saving uploaded audio: %s", str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to store audio file: {str(e)}"
        )
    finally:
        await file.close()

    # Create entry in DB
    mime_type = file.content_type or "audio/mpeg"
    create_recording_entry(
        rec_id=rec_id,
        original_filename=filename,
        file_path=str(file_path),
        file_size_bytes=total_bytes,
        mime_type=mime_type
    )

    # Execute transcription and optional summarisation
    if auto_transcribe:
        try:
            update_recording_status(rec_id, status="transcribing")
            segments, duration, full_text = transcribe_audio_file(str(file_path))
            
            # Save segments to DB
            from ..database import save_segments_to_db
            save_segments_to_db(rec_id, segments)
            update_recording_status(rec_id, status="transcribed", duration_seconds=duration)

            # If auto_summarize requested and transcription succeeded
            if auto_summarize:
                try:
                    update_recording_status(rec_id, status="summarizing")
                    summary_obj = summarize_conversation(segments=segments, speakers=[])
                    
                    from ..database import save_summary_entry
                    sum_id = f"sum_{uuid.uuid4().hex[:12]}"
                    save_summary_entry(
                        recording_id=rec_id,
                        summary_id=sum_id,
                        model_used=summary_obj.model_used or settings.GROQ_SUMMARY_MODEL,
                        title=summary_obj.title,
                        overall_summary=summary_obj.overall_summary,
                        data_dict=summary_obj.model_dump(),
                        status="completed"
                    )
                    update_recording_status(rec_id, status="completed")
                except GroqServiceException as sum_err:
                    # Crucial Requirement: Preserve successful transcripts if summaries fail!
                    logger.warning("Auto-summarise failed for %s, but transcript preserved: %s", rec_id, sum_err.message)
                    from ..database import save_summary_entry
                    sum_id = f"sum_{uuid.uuid4().hex[:12]}"
                    save_summary_entry(
                        recording_id=rec_id,
                        summary_id=sum_id,
                        model_used=settings.GROQ_SUMMARY_MODEL,
                        title="Transcript Generated (Summary Pending)",
                        overall_summary="Transcript generated successfully. Summarisation failed and can be retried.",
                        data_dict={},
                        status="failed",
                        error_message=sum_err.message
                    )
                    update_recording_status(rec_id, status="transcribed")
                except Exception as sum_err:
                    logger.warning("Auto-summarise unexpected failure for %s, transcript preserved: %s", rec_id, str(sum_err))
                    update_recording_status(rec_id, status="transcribed")
        except GroqServiceException as tx_err:
            update_recording_status(rec_id, status="error", error_message=tx_err.message)
            logger.error("Transcription failed for %s: %s", rec_id, tx_err.message)
        except Exception as tx_err:
            update_recording_status(rec_id, status="error", error_message=str(tx_err))
            logger.error("Unexpected transcription error for %s: %s", rec_id, str(tx_err))

    return get_recording_detail(rec_id)


@router.get("", response_model=List[RecordingBase])
def list_recordings():
    """List all audio recordings with duration and status."""
    rows = list_all_recordings()
    return [
        RecordingBase(
            id=r["id"],
            original_filename=r["original_filename"],
            file_size_bytes=r["file_size_bytes"],
            duration_seconds=r.get("duration_seconds", 0.0) or 0.0,
            status=r["status"],
            error_message=r.get("error_message"),
            created_at=r["created_at"]
        )
        for r in rows
    ]


@router.get("/{recording_id}", response_model=RecordingDetail)
def get_recording_detail(recording_id: str):
    """Get complete recording detail with segments, speakers, and summary."""
    rec = get_recording_entry(recording_id)
    if not rec:
        raise HTTPException(status_code=404, detail="Recording not found")
    
    segments = get_segments_by_recording(recording_id)
    speakers = get_speakers_by_recording(recording_id)
    summary_row = get_summary_by_recording(recording_id)
    
    summary_data = None
    summary_status = None
    summary_error = None
    
    if summary_row:
        summary_status = summary_row.get("status", "completed")
        summary_error = summary_row.get("error_message")
        if summary_status == "completed" and "data" in summary_row and summary_row["data"]:
            try:
                summary_data = summary_row["data"]
            except Exception:
                pass

    return RecordingDetail(
        id=rec["id"],
        original_filename=rec["original_filename"],
        file_size_bytes=rec["file_size_bytes"],
        duration_seconds=rec.get("duration_seconds", 0.0) or 0.0,
        status=rec["status"],
        error_message=rec.get("error_message"),
        created_at=rec["created_at"],
        segments=segments,
        speakers=speakers,
        summary=summary_data,
        summary_status=summary_status,
        summary_error=summary_error
    )


@router.get("/{recording_id}/audio")
def get_recording_audio(recording_id: str):
    """Stream / serve the recorded audio file for playback."""
    rec = get_recording_entry(recording_id)
    if not rec:
        raise HTTPException(status_code=404, detail="Recording not found")
    
    file_path = Path(rec["file_path"])
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Audio file on disk not found")
    
    mime_type = rec.get("mime_type") or "audio/mpeg"
    return FileResponse(
        path=str(file_path),
        media_type=mime_type,
        filename=rec["original_filename"]
    )


@router.delete("/{recording_id}")
def delete_recording(recording_id: str):
    """Delete a recording, its audio file, and all associated data."""
    rec = get_recording_entry(recording_id)
    if not rec:
        raise HTTPException(status_code=404, detail="Recording not found")
    
    # Remove file from disk
    file_path = Path(rec["file_path"])
    if file_path.exists():
        try:
            file_path.unlink()
        except Exception as e:
            logger.warning("Could not delete file %s: %s", file_path, str(e))
    
    delete_recording_entry(recording_id)
    return {"message": "Recording deleted successfully", "id": recording_id}
