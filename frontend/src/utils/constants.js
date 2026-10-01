export const GROQ_CONFIG = {
  TRANSCRIPTION_MODEL: "whisper-large-v3-turbo",
  SUMMARY_MODEL: "llama-3.3-70b-versatile",
  FALLBACK_SUMMARY_MODEL: "llama-3.1-8b-instant",
  MAX_FILE_SIZE_MB: 25,
  MAX_FILE_SIZE_BYTES: 25 * 1024 * 1024,
  ALLOWED_EXTENSIONS: ["mp3", "mp4", "mpeg", "mpga", "m4a", "wav", "webm", "ogg", "flac", "aac"],
  PROVIDER_NAME: "Groq Cloud AI",
  PROVIDER_DISCLOSURE: "Uploaded audio and transcripts are processed externally by Groq Cloud AI Services (whisper-large-v3-turbo & llama-3.3-70b-versatile).",
};

export const SPEAKER_COLORS = [
  "#8B2635", // Deep Burgundy
  "#1E4F7A", // Navy Blue
  "#1E6B45", // Forest Green
  "#B86200", // Warm Amber
  "#6A2E80", // Royal Purple
  "#A84B24", // Terracotta
  "#2B6B6F", // Deep Teal
  "#4A5568", // Slate
];
