import React, { useState, useRef } from 'react';
import { UploadCloud, FileAudio, AlertCircle, CheckCircle, Sparkles, X, ArrowUpRight } from 'lucide-react';
import { api } from '../api/client';
import { GROQ_CONFIG } from '../utils/constants';
import { formatBytes } from '../utils/formatters';

export default function AudioUploader({ onUploadSuccess, onError }) {
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [autoTranscribe, setAutoTranscribe] = useState(true);
  const [autoSummarize, setAutoSummarize] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [validationError, setValidationError] = useState(null);
  const fileInputRef = useRef(null);

  const validateFile = (file) => {
    setValidationError(null);
    if (!file) return false;

    // Check size
    if (file.size > GROQ_CONFIG.MAX_FILE_SIZE_BYTES) {
      const err = `File size (${formatBytes(file.size)}) exceeds Groq's maximum limit of ${GROQ_CONFIG.MAX_FILE_SIZE_MB}MB. Please compress or upload a shorter clip.`;
      setValidationError(err);
      if (onError) onError(err);
      return false;
    }

    // Check extension
    const ext = file.name.split('.').pop().toLowerCase();
    if (!GROQ_CONFIG.ALLOWED_EXTENSIONS.includes(ext)) {
      const err = `Unsupported format '.${ext}'. Supported formats: ${GROQ_CONFIG.ALLOWED_EXTENSIONS.join(', ')}`;
      setValidationError(err);
      if (onError) onError(err);
      return false;
    }

    return true;
  };

  const handleFileSelect = (file) => {
    if (validateFile(file)) {
      setSelectedFile(file);
    } else {
      setSelectedFile(null);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleUploadSubmit = async () => {
    if (!selectedFile) return;
    setUploading(true);
    setUploadProgress(20);

    try {
      setUploadProgress(45);
      const res = await api.uploadAudio(selectedFile, autoTranscribe, autoSummarize);
      setUploadProgress(100);
      onUploadSuccess(res);
      setSelectedFile(null);
    } catch (err) {
      console.error("Upload error:", err);
      const errMsg = err.message || "Upload failed. Please check your Groq API connection.";
      setValidationError(errMsg);
      if (onError) onError(errMsg, err.status);
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  return (
    <div className="retro-card" style={{ padding: '1.5rem', backgroundColor: 'var(--bg-card)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <h3 className="font-serif" style={{ fontSize: '1.25rem', color: 'var(--color-ink)' }}>
          Upload Audio File
        </h3>
        <span className="chip-status-burgundy" style={{ fontSize: '0.72rem' }}>
          Max {GROQ_CONFIG.MAX_FILE_SIZE_MB}MB (Groq Limit)
        </span>
      </div>

      {/* Drag & Drop Area */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        style={{
          border: `2px dashed ${dragOver ? 'var(--color-burgundy)' : 'var(--color-ink)'}`,
          backgroundColor: dragOver ? 'var(--color-burgundy-light)' : 'var(--bg-primary)',
          borderRadius: '4px',
          padding: '2rem 1.5rem',
          textAlign: 'center',
          cursor: 'pointer',
          transition: 'all 0.15s ease',
          marginBottom: '1.25rem'
        }}
      >
        <input
          type="file"
          ref={fileInputRef}
          style={{ display: 'none' }}
          accept=".mp3,.wav,.m4a,.webm,.ogg,.flac,.aac,.mp4"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              handleFileSelect(e.target.files[0]);
            }
          }}
        />

        <div style={{
          width: '48px',
          height: '48px',
          margin: '0 auto 0.75rem auto',
          borderRadius: '4px',
          backgroundColor: 'var(--bg-card)',
          border: '2px solid var(--color-ink)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '2px 2px 0px var(--color-ink)'
        }}>
          <UploadCloud size={24} style={{ color: 'var(--color-burgundy)' }} />
        </div>

        <p style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--color-ink)', marginBottom: '0.25rem' }}>
          {selectedFile ? selectedFile.name : 'Click to browse or drag & drop audio here'}
        </p>
        <p style={{ fontSize: '0.8rem', color: 'var(--color-ink-muted)' }}>
          {selectedFile ? `${formatBytes(selectedFile.size)} • Ready to upload` : 'Supports MP3, WAV, M4A, WEBM, OGG, FLAC, AAC'}
        </p>
      </div>

      {/* Validation Error Alert */}
      {validationError && (
        <div style={{
          backgroundColor: 'var(--color-burgundy-light)',
          border: '1.5px solid var(--color-burgundy)',
          borderRadius: '4px',
          padding: '0.75rem 1rem',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '0.6rem',
          marginBottom: '1rem',
          fontSize: '0.85rem',
          color: 'var(--color-burgundy-dark)'
        }}>
          <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            <strong>Upload Error:</strong> {validationError}
          </div>
        </div>
      )}

      {/* Options & Configuration */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '0.6rem',
        backgroundColor: 'var(--bg-primary)',
        padding: '0.85rem 1rem',
        borderRadius: '4px',
        border: '1.5px solid var(--color-border-light)',
        marginBottom: '1.25rem'
      }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer', fontSize: '0.88rem' }}>
          <input
            type="checkbox"
            className="custom-checkbox"
            checked={autoTranscribe}
            onChange={(e) => setAutoTranscribe(e.target.checked)}
          />
          <span>Auto-transcribe with <strong>Groq Whisper Large v3 Turbo</strong></span>
        </label>

        <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer', fontSize: '0.88rem' }}>
          <input
            type="checkbox"
            className="custom-checkbox"
            checked={autoSummarize}
            disabled={!autoTranscribe}
            onChange={(e) => setAutoSummarize(e.target.checked)}
          />
          <span>Auto-summarise with <strong>Groq Llama 3.3 70B Versatile</strong> (Structured Pydantic)</span>
        </label>
      </div>

      {/* External AI Processing Disclaimer */}
      <div style={{
        fontSize: '0.75rem',
        color: 'var(--color-ink-muted)',
        marginBottom: '1.25rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.4rem'
      }}>
        <Sparkles size={14} style={{ color: 'var(--color-burgundy)' }} />
        <span>Audio and transcript are processed externally by Groq Cloud AI services.</span>
      </div>

      {/* Upload Progress Bar */}
      {uploading && (
        <div style={{ marginBottom: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.25rem' }}>
            <span>Processing with Groq Cloud...</span>
            <span>{uploadProgress}%</span>
          </div>
          <div style={{
            width: '100%',
            height: '10px',
            backgroundColor: 'var(--bg-secondary)',
            border: '1.5px solid var(--color-ink)',
            borderRadius: '2px',
            overflow: 'hidden'
          }}>
            <div style={{
              width: `${uploadProgress}%`,
              height: '100%',
              backgroundColor: 'var(--color-burgundy)',
              transition: 'width 0.3s ease'
            }} />
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
        {selectedFile && (
          <button
            type="button"
            className="btn-secondary btn-sm"
            onClick={() => setSelectedFile(null)}
            disabled={uploading}
          >
            <X size={15} />
            <span>Clear</span>
          </button>
        )}
        <button
          type="button"
          className="btn-burgundy"
          onClick={handleUploadSubmit}
          disabled={!selectedFile || uploading}
          style={{ width: '100%', maxWidth: '240px' }}
        >
          <span>{uploading ? 'Processing Groq AI...' : 'Upload & Transcribe'}</span>
          <ArrowUpRight size={16} />
        </button>
      </div>
    </div>
  );
}
