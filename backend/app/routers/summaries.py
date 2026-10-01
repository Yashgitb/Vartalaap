import uuid
import logging
from typing import Optional
from fastapi import APIRouter, HTTPException, status

from ..config import settings
from ..database import (
    get_recording_entry,
    get_segments_by_recording,
    get_speakers_by_recording,
    get_summary_by_recording,
    save_summary_entry,
    update_recording_status
)
from ..schemas import StructuredSummaryData, SummarizeRequest
from ..groq_service import summarize_conversation, GroqServiceException

logger = logging.getLogger("vartalaap.summaries")
router = APIRouter(prefix="/api/recordings/{recording_id}", tags=["Summaries"])

@router.post("/summarize", response_model=StructuredSummaryData)
def generate_summary(recording_id: str, payload: Optional[SummarizeRequest] = None):
    """
    Generate structured meeting summary using Groq LLM (llama-3.3-70b-versatile).
    Extracts executive summary, person-wise summaries, goals, tasks, owners, deadlines,
    and supporting segment IDs.
    
    PRESERVES TRANSCRIPTS IF SUMMARIES FAIL.
    """
    rec = get_recording_entry(recording_id)
    if not rec:
        raise HTTPException(status_code=404, detail="Recording not found")
    
    segments = get_segments_by_recording(recording_id)
    if not segments:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No transcript segments found for this recording. Please transcribe the audio first."
        )
    
    speakers = get_speakers_by_recording(recording_id)
    custom_instructions = payload.custom_instructions if payload else None
    model_to_use = (payload.model if payload and payload.model else None) or settings.GROQ_SUMMARY_MODEL
    
    # Update status to summarizing
    update_recording_status(recording_id, status="summarizing")
    
    try:
        summary_obj = summarize_conversation(
            segments=segments,
            speakers=speakers,
            custom_instructions=custom_instructions,
            override_model=model_to_use
        )
        
        sum_id = f"sum_{uuid.uuid4().hex[:12]}"
        save_summary_entry(
            recording_id=recording_id,
            summary_id=sum_id,
            model_used=summary_obj.model_used or model_to_use,
            title=summary_obj.title,
            overall_summary=summary_obj.overall_summary,
            data_dict=summary_obj.model_dump(),
            status="completed"
        )
        update_recording_status(recording_id, status="completed")
        return summary_obj
        
    except GroqServiceException as e:
        logger.error("Groq summarisation failed for %s (transcript preserved): %s", recording_id, e.message)
        # Preserve transcript and record failure in summaries table
        sum_id = f"sum_{uuid.uuid4().hex[:12]}"
        save_summary_entry(
            recording_id=recording_id,
            summary_id=sum_id,
            model_used=model_to_use,
            title="Summarisation Failed",
            overall_summary=f"Summarisation failed: {e.message}",
            data_dict={},
            status="failed",
            error_message=e.message
        )
        # Restore status to 'transcribed' so user knows transcript is safe
        update_recording_status(recording_id, status="transcribed")
        raise HTTPException(status_code=e.status_code, detail=f"Summarisation error: {e.message}")
        
    except Exception as e:
        logger.error("Unexpected summarisation error for %s (transcript preserved): %s", recording_id, str(e), exc_info=True)
        sum_id = f"sum_{uuid.uuid4().hex[:12]}"
        save_summary_entry(
            recording_id=recording_id,
            summary_id=sum_id,
            model_used=model_to_use,
            title="Summarisation Failed",
            overall_summary=f"Unexpected error: {str(e)}",
            data_dict={},
            status="failed",
            error_message=str(e)
        )
        update_recording_status(recording_id, status="transcribed")
        raise HTTPException(status_code=500, detail=f"Failed to generate summary: {str(e)}")


@router.get("/summary")
def get_recording_summary(recording_id: str):
    """Retrieve existing summary data for the recording."""
    rec = get_recording_entry(recording_id)
    if not rec:
        raise HTTPException(status_code=404, detail="Recording not found")
    
    summary_row = get_summary_by_recording(recording_id)
    if not summary_row:
        raise HTTPException(status_code=404, detail="Summary not generated yet for this recording")
    
    return summary_row
