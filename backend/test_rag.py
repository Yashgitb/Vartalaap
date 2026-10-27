"""
Automated Test Suite for Vartalaap RAG Meeting Chatbot.
Verifies all 7 core testing scenarios specified in the task requirements:
1. Questions whose answers are explicitly present in the transcript.
2. Questions requiring information from multiple transcript sections.
3. Questions about topics never discussed in the meeting.
4. Completely unrelated questions.
5. Questions involving people, decisions, or events not mentioned in the transcript.
6. Ensure information from one meeting never appears in another meeting's answers (Meeting Isolation).
7. Ensure existing summary and insights functionality remains unaffected.
"""

import unittest
import json
from fastapi.testclient import TestClient

from app.main import app
from app.database import (
    get_recording_entry,
    get_summary_by_recording,
    get_segments_by_recording,
    get_embeddings_for_recording
)
from app.rag_service import (
    FALLBACK_RESPONSE,
    index_recording_transcript,
    retrieve_relevant_chunks,
    answer_question_with_rag
)

class TestVartalaapRAGChatbot(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)
        # We use the demo recording: rec_demo_site_sync_01
        cls.demo_rec_id = "rec_demo_site_sync_01"
        cls.sprint_rec_id = "rec_2736046e61ae"

        # Index both meetings
        index_recording_transcript(cls.demo_rec_id)
        index_recording_transcript(cls.sprint_rec_id)

    def test_01_explicit_answer_present(self):
        """Test 1: Questions whose answers are explicitly present in the transcript."""
        # In demo: "Regarding procurement, we need 340 bags of OPC 53 cement and 12 tons of TMT steel delivered to the site by Friday afternoon."
        response = self.client.post(
            f"/api/recordings/{self.demo_rec_id}/chat",
            json={"question": "How many bags of cement and tons of steel were requested?"}
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        
        self.assertFalse(data["is_fallback"], "Should not be a fallback answer")
        self.assertIn("340", data["answer"])
        self.assertIn("12", data["answer"])
        self.assertTrue(len(data["sources"]) > 0, "Should return retrieved source chunks")
        self.assertFalse(data["is_fallback"])
        print("\n[TEST 1 PASSED] Explicit Answer Present:\n", data["answer"][:120], "...")

    def test_02_multi_section_information(self):
        """Test 2: Questions requiring information from multiple transcript sections."""
        # Demo meeting involves:
        # - Ananya: Foundation testing passed (segment 1)
        # - Rohan: 340 bags cement & 12 tons steel by Friday (segment 2)
        # - Vikram: 42% budget ceiling (segment 3), PM sign off by 2 PM (segment 5)
        response = self.client.post(
            f"/api/recordings/{self.demo_rec_id}/chat",
            json={"question": "What tasks and responsibilities were agreed upon by Vikram and Ananya?"}
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        
        self.assertFalse(data["is_fallback"])
        # Should synthesize points involving Vikram and Ananya
        self.assertTrue(len(data["sources"]) >= 2, "Should retrieve multiple source chunks")
        print("\n[TEST 2 PASSED] Multi-Section Synthesis:\n", data["answer"][:120], "...")

    def test_03_topic_never_discussed(self):
        """Test 3: Questions about topics never discussed in the meeting."""
        response = self.client.post(
            f"/api/recordings/{self.demo_rec_id}/chat",
            json={"question": "What was discussed regarding the quantum computing algorithm?"}
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        
        self.assertTrue(data["is_fallback"])
        self.assertEqual(data["answer"], FALLBACK_RESPONSE)
        print("\n[TEST 3 PASSED] Topic Never Discussed Fallback:", repr(data["answer"]))

    def test_04_completely_unrelated_question(self):
        """Test 4: Completely unrelated questions (e.g. recipe, weather, general trivia)."""
        response = self.client.post(
            f"/api/recordings/{self.demo_rec_id}/chat",
            json={"question": "Can you give me a recipe for chocolate chip cookies?"}
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        
        self.assertTrue(data["is_fallback"])
        self.assertEqual(data["answer"], FALLBACK_RESPONSE)
        print("\n[TEST 4 PASSED] Unrelated Question Fallback:", repr(data["answer"]))

    def test_05_unmentioned_people_and_decisions(self):
        """Test 5: Questions involving people, decisions, or events not mentioned in the transcript."""
        # Alice, Bob, or Elon Musk are not in Whitefield Tower A meeting
        response = self.client.post(
            f"/api/recordings/{self.demo_rec_id}/chat",
            json={"question": "What did Alice decide regarding the marketing campaign budget?"}
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        
        self.assertTrue(data["is_fallback"])
        self.assertEqual(data["answer"], FALLBACK_RESPONSE)
        print("\n[TEST 5 PASSED] Unmentioned People/Decisions Fallback:", repr(data["answer"]))

    def test_06_meeting_data_isolation(self):
        """Test 6: Ensure information from one meeting never appears in another meeting's answers."""
        # The authentication bug is discussed ONLY in rec_2736046e61ae, NOT in rec_demo_site_sync_01
        response = self.client.post(
            f"/api/recordings/{self.demo_rec_id}/chat",
            json={"question": "What decisions were made about reverting the authentication bug?"}
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        
        # When asked to the construction meeting, it MUST return fallback!
        self.assertTrue(data["is_fallback"])
        self.assertEqual(data["answer"], FALLBACK_RESPONSE)
        print("\n[TEST 6 PASSED] Meeting Isolation Enforced (No cross-meeting contamination).")

    def test_07_summary_and_insights_unaffected(self):
        """Test 7: Ensure existing summary and insights functionality remains unaffected."""
        # Verify summaries endpoint still works and returns full structured data
        response = self.client.get(f"/api/recordings/{self.demo_rec_id}/summary")
        self.assertEqual(response.status_code, 200)
        summary_row = response.json()
        
        self.assertEqual(summary_row["status"], "completed")
        self.assertIn("data", summary_row)
        data_dict = summary_row["data"]
        
        # Check core summary structure
        self.assertIn("title", data_dict)
        self.assertIn("overall_summary", data_dict)
        self.assertIn("tasks", data_dict)
        self.assertIn("goals", data_dict)
        self.assertIn("decisions", data_dict)
        self.assertIn("person_summaries", data_dict)
        print("\n[TEST 7 PASSED] Summary and Insights Intact & Regressions Free.")


if __name__ == "__main__":
    unittest.main(verbosity=2)
