import math
import struct
import wave
from pathlib import Path
from app.database import (
    init_db,
    create_recording_entry,
    save_segments_to_db,
    create_speaker_entry,
    save_summary_entry,
    update_recording_status
)
from app.config import RECORDINGS_DIR

def generate_sample_wav(filename: str, duration_sec: int = 32) -> Path:
    file_path = RECORDINGS_DIR / filename
    sample_rate = 16000
    n_samples = int(sample_rate * duration_sec)
    
    with wave.open(str(file_path), 'w') as wav_file:
        wav_file.setnchannels(1)        # mono
        wav_file.setsampwidth(2)        # 16-bit
        wav_file.setframerate(sample_rate)
        
        for i in range(n_samples):
            # Generate modulated multi-frequency wave
            t = i / sample_rate
            freq = 220 + 50 * math.sin(2 * math.pi * 0.5 * t)
            sample = int(10000 * math.sin(2 * math.pi * freq * t) * (0.8 + 0.2 * math.sin(2 * math.pi * 3 * t)))
            wav_file.writeframes(struct.pack('<h', sample))
            
    return file_path

def seed_demo_data():
    init_db()
    rec_id = "rec_demo_site_sync_01"
    from app.database import delete_recording_entry
    delete_recording_entry(rec_id)

    wav_path = generate_sample_wav("q4_infrastructure_sync.wav", 32)
    file_size = wav_path.stat().st_size
    
    create_recording_entry(
        rec_id=rec_id,
        original_filename="q4_infrastructure_sync.wav",
        file_path=str(wav_path),
        file_size_bytes=file_size,
        mime_type="audio/wav"
    )
    
    # 1. Create Speakers
    spk1 = create_speaker_entry(rec_id, "spk_1", "Vikram Malhotra", "Project Manager", "#8B2635")
    spk2 = create_speaker_entry(rec_id, "spk_2", "Ananya Deshmukh", "Lead Structural Architect", "#1E4F7A")
    spk3 = create_speaker_entry(rec_id, "spk_3", "Rohan Verma", "Site Procurement Lead", "#1E6B45")

    # 2. Add segments with exact timestamps & speaker attribution
    segments = [
        {
            "id": 0,
            "start": 0.0,
            "end": 4.8,
            "text": "Good morning team. Let's review the Whitefield Tower A procurement progress and contractor approvals for this month.",
            "speaker_id": "spk_1",
            "speaker_name": "Vikram Malhotra",
            "avg_logprob": -0.15
        },
        {
            "id": 1,
            "start": 4.8,
            "end": 10.2,
            "text": "From the structural engineering side, the foundation testing passed all safety benchmarks. We are cleared to release the concrete pour request.",
            "speaker_id": "spk_2",
            "speaker_name": "Ananya Deshmukh",
            "avg_logprob": -0.12
        },
        {
            "id": 2,
            "start": 10.2,
            "end": 16.5,
            "text": "Regarding procurement, we need 340 bags of OPC 53 cement and 12 tons of TMT steel delivered to the site by Friday afternoon.",
            "speaker_id": "spk_3",
            "speaker_name": "Rohan Verma",
            "avg_logprob": -0.18
        },
        {
            "id": 3,
            "start": 16.5,
            "end": 22.0,
            "text": "I will get the vendor quotation compared with our budget ceiling. The current budget utilization is at 42%, well within safe parameters.",
            "speaker_id": "spk_1",
            "speaker_name": "Vikram Malhotra",
            "avg_logprob": -0.14
        },
        {
            "id": 4,
            "start": 22.0,
            "end": 27.4,
            "text": "Please make sure Finance approves the Purchase Order before Thursday so the delivery trucks are dispatched on time.",
            "speaker_id": "spk_3",
            "speaker_name": "Rohan Verma",
            "avg_logprob": -0.16
        },
        {
            "id": 5,
            "start": 27.4,
            "end": 32.0,
            "text": "Agreed. I will sign off on the operational request by 2 PM today, and Ananya will verify the steel gauge certification upon arrival.",
            "speaker_id": "spk_1",
            "speaker_name": "Vikram Malhotra",
            "avg_logprob": -0.11
        }
    ]
    save_segments_to_db(rec_id, segments)
    update_recording_status(rec_id, "completed", duration_seconds=32.0)

    # 3. Create Structured Summary matching Groq Llama 3.3 Output schema
    summary_data = {
        "title": "Whitefield Tower A Procurement & Foundation Approval Sync",
        "overall_summary": "The project leadership aligned on material procurement and operational approvals for Whitefield Tower A. Structural safety benchmarks were verified, clearing the way for the foundation concrete pour. Material requirements of 340 bags of OPC 53 cement and 12 tons of TMT steel were approved within the 42% budget limit, with purchase orders scheduled for Thursday.",
        "key_discussion_points": [
            "Whitefield Tower A foundation testing passed all structural safety benchmarks.",
            "Material procurement requirements: 340 bags of OPC 53 cement and 12 tons of TMT steel.",
            "Budget utilization is currently tracking at 42%, safely within allocation.",
            "Two-step approval workflow established: PM operational approval today by 2 PM followed by Finance PO release."
        ],
        "person_summaries": [
            {
                "speaker_name": "Vikram Malhotra",
                "role": "Project Manager",
                "summary": "Led the meeting, confirmed budget health (42%), and committed to operational sign-off by 2 PM today.",
                "key_contributions": [
                    "Reviewed contractor approval workflow",
                    "Validated budget parameters",
                    "Committed to operational sign-off by 2 PM"
                ],
                "supporting_segment_ids": [0, 3, 5]
            },
            {
                "speaker_name": "Ananya Deshmukh",
                "role": "Lead Structural Architect",
                "summary": "Confirmed successful foundation testing and took responsibility for verifying steel gauge certifications upon on-site delivery.",
                "key_contributions": [
                    "Cleared concrete pour based on passed safety tests",
                    "Assigned to verify steel certifications on site"
                ],
                "supporting_segment_ids": [1, 5]
            },
            {
                "speaker_name": "Rohan Verma",
                "role": "Site Procurement Lead",
                "summary": "Detailed specific material requirements and highlighted the urgency of Finance approval by Thursday for Friday delivery.",
                "key_contributions": [
                    "Requested 340 cement bags & 12 tons steel",
                    "Flagged Thursday Finance PO deadline"
                ],
                "supporting_segment_ids": [2, 4]
            }
        ],
        "goals": [
            {
                "id": "goal_1",
                "goal": "Complete foundation concrete pour for Whitefield Tower A",
                "status": "in_progress",
                "supporting_segment_ids": [0, 1]
            },
            {
                "id": "goal_2",
                "goal": "Procure and deliver 340 bags cement & 12 tons TMT steel to site by Friday",
                "status": "planned",
                "supporting_segment_ids": [2, 4]
            }
        ],
        "tasks": [
            {
                "id": "task_1",
                "action": "Sign off on operational contractor request for material order",
                "owner": "Vikram Malhotra",
                "deadline": "Today at 2:00 PM",
                "priority": "high",
                "supporting_segment_ids": [0, 5],
                "completed": False
            },
            {
                "id": "task_2",
                "action": "Issue Purchase Order (PO) and release payment through Finance",
                "owner": "Finance Team / Vikram",
                "deadline": "Thursday afternoon",
                "priority": "high",
                "supporting_segment_ids": [3, 4],
                "completed": False
            },
            {
                "id": "task_3",
                "action": "Inspect and verify TMT steel gauge certification upon truck arrival",
                "owner": "Ananya Deshmukh",
                "deadline": "Friday upon delivery",
                "priority": "medium",
                "supporting_segment_ids": [5],
                "completed": False
            }
        ],
        "decisions": [
            {
                "id": "dec_1",
                "decision": "Concrete pour cleared to proceed based on verified safety test data",
                "rationale": "Foundation testing met all structural engineering requirements",
                "supporting_segment_ids": [1]
            },
            {
                "id": "dec_2",
                "decision": "Order approved within existing 42% budget threshold",
                "rationale": "Vendor quote matches financial allocation targets",
                "supporting_segment_ids": [3]
            }
        ],
        "model_used": "llama-3.3-70b-versatile",
        "generated_at": "2026-10-01 06:15:00",
        "external_provider": "Groq Cloud AI (Official SDK)"
    }

    save_summary_entry(
        recording_id=rec_id,
        summary_id="sum_demo_01",
        model_used="llama-3.3-70b-versatile",
        title="Whitefield Tower A Procurement & Foundation Approval Sync",
        overall_summary=summary_data["overall_summary"],
        data_dict=summary_data,
        status="completed"
    )
    print("Demo recording, speakers, segments, and structured Groq summary seeded successfully!")

if __name__ == "__main__":
    seed_demo_data()
