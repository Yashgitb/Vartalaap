import logging
from fastapi import APIRouter, HTTPException, status
from ..database import get_recording_entry, count_embeddings_for_recording
from ..schemas import ChatQueryRequest, ChatQueryResponse, ChatIndexStatus
from ..rag_service import (
    answer_question_with_rag,
    index_recording_transcript,
    FALLBACK_RESPONSE,
    GroqServiceException
)

logger = logging.getLogger("vartalaap.routers.rag")
router = APIRouter(prefix="/api/recordings/{recording_id}/chat", tags=["Meeting Chatbot (RAG)"])

@router.post("", response_model=ChatQueryResponse)
def ask_meeting_question(recording_id: str, payload: ChatQueryRequest):
    """
    Ask a question about a specific meeting transcript using Retrieval-Augmented Generation (RAG).
    Returns an answer grounded strictly in the transcript, citing timestamps, or returns:
    'This information is not available in the meeting transcript.'
    """
    rec = get_recording_entry(recording_id)
    if not rec:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Recording {recording_id} not found."
        )

    try:
        response = answer_question_with_rag(
            recording_id=recording_id,
            question=payload.question,
            top_k=payload.top_k
        )
        return response
    except GroqServiceException as e:
        logger.error("RAG Service Error for %s: %s", recording_id, e.message)
        raise HTTPException(status_code=e.status_code, detail=e.message)
    except Exception as e:
        logger.error("Unexpected error in RAG chat for %s: %s", recording_id, str(e), exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Chatbot failed to process question: {str(e)}"
        )


@router.get("/status", response_model=ChatIndexStatus)
def get_chat_index_status(recording_id: str):
    """
    Check if transcript embeddings are ready for this recording.
    """
    rec = get_recording_entry(recording_id)
    if not rec:
        raise HTTPException(status_code=404, detail="Recording not found")

    count = count_embeddings_for_recording(recording_id)
    return ChatIndexStatus(
        recording_id=recording_id,
        is_indexed=count > 0,
        chunk_count=count
    )


@router.post("/index", response_model=ChatIndexStatus)
def reindex_transcript(recording_id: str):
    """
    Force generate or update transcript chunk embeddings for this recording.
    """
    rec = get_recording_entry(recording_id)
    if not rec:
        raise HTTPException(status_code=404, detail="Recording not found")

    try:
        chunks = index_recording_transcript(recording_id, force_reindex=True)
        return ChatIndexStatus(
            recording_id=recording_id,
            is_indexed=len(chunks) > 0,
            chunk_count=len(chunks)
        )
    except Exception as e:
        logger.error("Failed to reindex transcript for %s: %s", recording_id, str(e), exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to index transcript: {str(e)}"
        )
