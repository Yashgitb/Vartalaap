import uuid
import logging
from typing import List
from fastapi import APIRouter, HTTPException

from ..database import (
    get_recording_entry,
    create_speaker_entry,
    get_speakers_by_recording,
    delete_speaker_entry
)
from ..schemas import Speaker, SpeakerCreate

logger = logging.getLogger("vartalaap.speakers")
router = APIRouter(prefix="/api/recordings/{recording_id}/speakers", tags=["Speakers"])

@router.get("", response_model=List[Speaker])
def list_speakers(recording_id: str):
    """List all speakers defined for a recording."""
    rec = get_recording_entry(recording_id)
    if not rec:
        raise HTTPException(status_code=404, detail="Recording not found")
    return get_speakers_by_recording(recording_id)


@router.post("", response_model=Speaker)
def create_speaker(recording_id: str, payload: SpeakerCreate):
    """Add a new speaker to the recording's speaker roster."""
    rec = get_recording_entry(recording_id)
    if not rec:
        raise HTTPException(status_code=404, detail="Recording not found")
    
    speaker_id = f"spk_{uuid.uuid4().hex[:8]}"
    created = create_speaker_entry(
        recording_id=recording_id,
        speaker_id=speaker_id,
        name=payload.name.strip(),
        role=payload.role.strip() if payload.role else None,
        color=payload.color
    )
    return created


@router.delete("/{speaker_id}")
def delete_speaker(recording_id: str, speaker_id: str):
    """Delete a speaker and unassign from affected segments."""
    rec = get_recording_entry(recording_id)
    if not rec:
        raise HTTPException(status_code=404, detail="Recording not found")
    
    delete_speaker_entry(recording_id, speaker_id)
    return {"message": "Speaker removed successfully", "speaker_id": speaker_id}
