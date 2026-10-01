const API_BASE = "";

async function handleResponse(response) {
  if (!response.ok) {
    let errorDetail = `Request failed with status ${response.status}`;
    try {
      const errorJson = await response.json();
      errorDetail = errorJson.detail || errorJson.message || errorDetail;
    } catch {
      const text = await response.text();
      if (text) errorDetail = text;
    }
    const err = new Error(errorDetail);
    err.status = response.status;
    throw err;
  }
  return response.json();
}

export const api = {
  // Health & Config
  getHealth: async () => {
    const res = await fetch(`${API_BASE}/api/health`);
    return handleResponse(res);
  },

  // Recordings
  listRecordings: async () => {
    const res = await fetch(`${API_BASE}/api/recordings`);
    return handleResponse(res);
  },

  getRecordingDetail: async (id) => {
    const res = await fetch(`${API_BASE}/api/recordings/${id}`);
    return handleResponse(res);
  },

  uploadAudio: async (file, autoTranscribe = true, autoSummarize = true) => {
    const formData = new FormData();
    formData.append("file", file);
    const url = `${API_BASE}/api/recordings/upload?auto_transcribe=${autoTranscribe}&auto_summarize=${autoSummarize}`;
    const res = await fetch(url, {
      method: "POST",
      body: formData,
    });
    return handleResponse(res);
  },

  deleteRecording: async (id) => {
    const res = await fetch(`${API_BASE}/api/recordings/${id}`, {
      method: "DELETE",
    });
    return handleResponse(res);
  },

  getAudioUrl: (id) => `${API_BASE}/api/recordings/${id}/audio`,

  // Transcription
  transcribeRecording: async (id, prompt = null) => {
    let url = `${API_BASE}/api/recordings/${id}/transcribe`;
    if (prompt) {
      url += `?prompt=${encodeURIComponent(prompt)}`;
    }
    const res = await fetch(url, {
      method: "POST",
    });
    return handleResponse(res);
  },

  // Segments & Speaker Attribution
  assignSegmentSpeaker: async (recordingId, segmentId, speakerId, speakerName) => {
    const res = await fetch(`${API_BASE}/api/recordings/${recordingId}/segments/${segmentId}/speaker`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ speaker_id: speakerId, speaker_name: speakerName }),
    });
    return handleResponse(res);
  },

  batchAssignSpeaker: async (recordingId, segmentIds, speakerId, speakerName) => {
    const res = await fetch(`${API_BASE}/api/recordings/${recordingId}/segments/batch-speaker`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        segment_ids: segmentIds,
        speaker_id: speakerId,
        speaker_name: speakerName,
      }),
    });
    return handleResponse(res);
  },

  // Speakers
  createSpeaker: async (recordingId, name, role = null, color = "#8B2635") => {
    const res = await fetch(`${API_BASE}/api/recordings/${recordingId}/speakers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, role, color }),
    });
    return handleResponse(res);
  },

  deleteSpeaker: async (recordingId, speakerId) => {
    const res = await fetch(`${API_BASE}/api/recordings/${recordingId}/speakers/${speakerId}`, {
      method: "DELETE",
    });
    return handleResponse(res);
  },

  // Summaries
  summarizeRecording: async (recordingId, customInstructions = null, model = null) => {
    const res = await fetch(`${API_BASE}/api/recordings/${recordingId}/summarize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        custom_instructions: customInstructions,
        model: model,
      }),
    });
    return handleResponse(res);
  },

  getExportUrl: (recordingId, format) => `${API_BASE}/api/recordings/${recordingId}/export/${format}`,
};
