import logging
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Response, status

from ..database import (
    get_recording_entry,
    get_segments_by_recording,
    save_segments_to_db,
    update_single_segment_speaker,
    batch_update_segments_speaker,
    update_recording_status
)
from ..schemas import (
    TranscriptSegment,
    SegmentSpeakerUpdate,
    BatchSegmentSpeakerUpdate
)
from ..groq_service import transcribe_audio_file, GroqServiceException

logger = logging.getLogger("vartalaap.transcripts")
router = APIRouter(prefix="/api/recordings/{recording_id}", tags=["Transcripts"])

@router.post("/transcribe", response_model=List[TranscriptSegment])
def trigger_transcription(recording_id: str, prompt: Optional[str] = None):
    """
    Trigger speech-to-text transcription using Groq Whisper (whisper-large-v3-turbo).
    Returns segment-level timestamps and text.
    """
    rec = get_recording_entry(recording_id)
    if not rec:
        raise HTTPException(status_code=404, detail="Recording not found")

    file_path = rec["file_path"]
    try:
        update_recording_status(recording_id, status="transcribing")
        segments, duration, full_text = transcribe_audio_file(file_path, prompt=prompt)
        
        save_segments_to_db(recording_id, segments)
        update_recording_status(recording_id, status="transcribed", duration_seconds=duration)
        return segments
    except GroqServiceException as e:
        update_recording_status(recording_id, status="error", error_message=e.message)
        raise HTTPException(status_code=e.status_code, detail=e.message)
    except Exception as e:
        update_recording_status(recording_id, status="error", error_message=str(e))
        raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")


@router.get("/segments", response_model=List[TranscriptSegment])
def get_recording_segments(recording_id: str):
    """Retrieve all transcript segments with timestamps and speaker attribution."""
    rec = get_recording_entry(recording_id)
    if not rec:
        raise HTTPException(status_code=404, detail="Recording not found")
    return get_segments_by_recording(recording_id)


@router.put("/segments/{segment_id}/speaker")
def update_segment_speaker(recording_id: str, segment_id: int, payload: SegmentSpeakerUpdate):
    """Assign or change speaker for a specific transcript segment."""
    rec = get_recording_entry(recording_id)
    if not rec:
        raise HTTPException(status_code=404, detail="Recording not found")
    
    update_single_segment_speaker(
        recording_id=recording_id,
        segment_id=segment_id,
        speaker_id=payload.speaker_id,
        speaker_name=payload.speaker_name
    )
    return {"message": "Speaker assigned to segment", "segment_id": segment_id, "speaker_name": payload.speaker_name}


@router.put("/segments/batch-speaker")
def batch_assign_speaker(recording_id: str, payload: BatchSegmentSpeakerUpdate):
    """Batch assign a speaker to multiple transcript segment IDs."""
    rec = get_recording_entry(recording_id)
    if not rec:
        raise HTTPException(status_code=404, detail="Recording not found")
    
    batch_update_segments_speaker(
        recording_id=recording_id,
        segment_ids=payload.segment_ids,
        speaker_id=payload.speaker_id,
        speaker_name=payload.speaker_name
    )
    return {
        "message": f"Assigned speaker '{payload.speaker_name}' to {len(payload.segment_ids)} segments",
        "count": len(payload.segment_ids)
    }


@router.get("/export/{export_format}")
def export_transcript(recording_id: str, export_format: str):
    """
    Export transcript in SRT, Markdown, Plain Text, or JSON format.
    """
    rec = get_recording_entry(recording_id)
    if not rec:
        raise HTTPException(status_code=404, detail="Recording not found")
    
    segments = get_segments_by_recording(recording_id)
    filename_base = rec["original_filename"].rsplit(".", 1)[0]
    
    def format_srt_time(sec: float) -> str:
        hours = int(sec // 3600)
        minutes = int((sec % 3600) // 60)
        seconds = int(sec % 60)
        millis = int((sec - int(sec)) * 1000)
        return f"{hours:02d}:{minutes:02d}:{seconds:02d},{millis:03d}"

    if export_format.lower() == "srt":
        srt_lines = []
        for i, s in enumerate(segments, 1):
            speaker_tag = f"[{s['speaker_name']}] " if s.get("speaker_name") else ""
            srt_lines.append(f"{i}")
            srt_lines.append(f"{format_srt_time(s['start'])} --> {format_srt_time(s['end'])}")
            srt_lines.append(f"{speaker_tag}{s['text']}\n")
        content = "\n".join(srt_lines)
        return Response(
            content=content,
            media_type="text/plain; charset=utf-8",
            headers={"Content-Disposition": f'attachment; filename="{filename_base}.srt"'}
        )

    elif export_format.lower() == "md" or export_format.lower() == "markdown":
        md_lines = [
            f"# Vartalaap Transcript: {rec['original_filename']}",
            f"- **Duration:** {rec.get('duration_seconds', 0):.1f}s",
            f"- **Processed by:** Groq Cloud AI (whisper-large-v3-turbo)",
            f"- **Date:** {rec['created_at']}\n",
            "## Transcript\n"
        ]
        for s in segments:
            speaker = s.get("speaker_name") or "Unassigned"
            time_tag = f"`[{s['start']:.1f}s - {s['end']:.1f}s]`"
            md_lines.append(f"{time_tag} **{speaker}**: {s['text']}\n")
        content = "\n".join(md_lines)
        return Response(
            content=content,
            media_type="text/markdown; charset=utf-8",
            headers={"Content-Disposition": f'attachment; filename="{filename_base}.md"'}
        )

    elif export_format.lower() == "txt":
        txt_lines = []
        for s in segments:
            speaker = f"[{s['speaker_name']}] " if s.get("speaker_name") else ""
            txt_lines.append(f"[{s['start']:.1f}s - {s['end']:.1f}s] {speaker}{s['text']}")
        content = "\n".join(txt_lines)
        return Response(
            content=content,
            media_type="text/plain; charset=utf-8",
            headers={"Content-Disposition": f'attachment; filename="{filename_base}.txt"'}
        )
    
    elif export_format.lower() == "json":
        import json
        content = json.dumps({
            "recording_id": recording_id,
            "filename": rec["original_filename"],
            "duration": rec.get("duration_seconds", 0),
            "segments": segments
        }, indent=2)
        return Response(
            content=content,
            media_type="application/json",
            headers={"Content-Disposition": f'attachment; filename="{filename_base}.json"'}
        )

    raise HTTPException(status_code=400, detail=f"Unsupported export format '{export_format}'. Use srt, md, txt, or json.")
