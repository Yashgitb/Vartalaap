from typing import List, Optional, Any
from pydantic import BaseModel, Field

# --- Transcript & Segment Schemas ---

class TranscriptSegment(BaseModel):
    id: int = Field(..., description="Segment ID (0-indexed or Whisper segment index)")
    start: float = Field(..., description="Start timestamp in seconds")
    end: float = Field(..., description="End timestamp in seconds")
    text: str = Field(..., description="Transcribed text for this segment")
    speaker_id: Optional[str] = Field(None, description="Assigned speaker unique ID")
    speaker_name: Optional[str] = Field(None, description="Assigned speaker display name")
    avg_logprob: Optional[float] = Field(None, description="Average log probability from Whisper")

class SegmentSpeakerUpdate(BaseModel):
    speaker_id: Optional[str] = None
    speaker_name: Optional[str] = None

class BatchSegmentSpeakerUpdate(BaseModel):
    segment_ids: List[int]
    speaker_id: Optional[str] = None
    speaker_name: Optional[str] = None

# --- Speaker Schemas ---

class SpeakerBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    role: Optional[str] = Field(None, max_length=100)
    color: str = Field("#8B2635", description="Hex color code for speaker badge")

class SpeakerCreate(SpeakerBase):
    pass

class Speaker(SpeakerBase):
    id: str
    recording_id: str
    created_at: str

# --- Structured Summarisation Schemas (Groq LLM Structured Output) ---

class TaskItem(BaseModel):
    id: str = Field(..., description="Unique task identifier, e.g. task_1")
    action: str = Field(..., description="Specific, actionable task description")
    owner: str = Field("Unassigned", description="Person responsible or assigned for this task")
    deadline: str = Field("Not specified", description="Target deadline or timeframe if mentioned")
    priority: str = Field("medium", description="Priority level: high, medium, low")
    supporting_segment_ids: List[int] = Field(default_factory=list, description="IDs of transcript segments directly supporting this task")
    completed: bool = Field(False, description="Whether the task is checked off")

class GoalItem(BaseModel):
    id: str = Field(..., description="Unique goal identifier, e.g. goal_1")
    goal: str = Field(..., description="Core objective, milestone, or target discussed")
    status: str = Field("planned", description="Status: achieved, in_progress, planned")
    supporting_segment_ids: List[int] = Field(default_factory=list, description="IDs of transcript segments supporting this goal")

class PersonSummary(BaseModel):
    speaker_name: str = Field(..., description="Speaker or participant name as assigned")
    role: Optional[str] = Field(None, description="Role or department if known")
    summary: str = Field(..., description="Concise synthesis of what this person discussed, proposed, or committed to")
    key_contributions: List[str] = Field(default_factory=list, description="Bullet points of key points raised by this person")
    supporting_segment_ids: List[int] = Field(default_factory=list, description="Segment IDs where this person spoke")

class DecisionItem(BaseModel):
    id: str = Field(..., description="Unique decision identifier, e.g. dec_1")
    decision: str = Field(..., description="Key decision or agreement reached")
    rationale: str = Field("", description="Context or justification behind the decision")
    supporting_segment_ids: List[int] = Field(default_factory=list, description="Segment IDs supporting this decision")

class StructuredSummaryData(BaseModel):
    title: str = Field(..., description="Clear, concise title summarizing the meeting topic")
    overall_summary: str = Field(..., description="Comprehensive executive summary of the discussion")
    key_discussion_points: List[str] = Field(default_factory=list, description="Key bullet points summarizing main topics")
    person_summaries: List[PersonSummary] = Field(default_factory=list, description="Person-wise summaries of contributions")
    goals: List[GoalItem] = Field(default_factory=list, description="List of identified goals and milestones")
    tasks: List[TaskItem] = Field(default_factory=list, description="Actionable tasks with owners and deadlines")
    decisions: List[DecisionItem] = Field(default_factory=list, description="Key decisions made during the conversation")
    model_used: Optional[str] = None
    generated_at: Optional[str] = None
    external_provider: str = "Groq Cloud AI"

# --- Recording & API Schemas ---

class RecordingBase(BaseModel):
    id: str
    original_filename: str
    file_size_bytes: int
    duration_seconds: Optional[float] = 0.0
    status: str  # uploaded, transcribing, transcribed, summarizing, completed, error
    error_message: Optional[str] = None
    created_at: str

class RecordingDetail(RecordingBase):
    segments: List[TranscriptSegment] = []
    speakers: List[Speaker] = []
    summary: Optional[StructuredSummaryData] = None
    summary_status: Optional[str] = None  # completed, failed, not_started
    summary_error: Optional[str] = None

class HealthStatus(BaseModel):
    status: str = "ok"
    has_groq_api_key: bool
    api_key_masked: Optional[str] = None
    transcription_model: str
    summary_model: str
    max_file_size_mb: int
    external_ai_provider: str = "Groq Cloud"
    provider_disclosure: str = "All audio transcription and LLM summarisation are processed securely via Groq Cloud APIs."

class SummarizeRequest(BaseModel):
    custom_instructions: Optional[str] = None
    model: Optional[str] = None
