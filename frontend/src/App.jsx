import React, { useState, useEffect, useCallback } from 'react';
import { Mic, UploadCloud, History, Radio, ArrowRight, Play, AlertCircle, RefreshCw, FileText, CheckCircle2 } from 'lucide-react';
import { api } from './api/client';
import Header from './components/Header';
import HeroWorkflow from './components/HeroWorkflow';
import AudioUploader from './components/AudioUploader';
import AudioRecorder from './components/AudioRecorder';
import AudioPlayer from './components/AudioPlayer';
import TranscriptView from './components/TranscriptView';
import SummaryView from './components/SummaryView';
import SpeakerManager from './components/SpeakerManager';
import RecordingsList from './components/RecordingsList';
import ModelInspector from './components/ModelInspector';
import ErrorModal from './components/ErrorModal';

export default function App() {
  const [health, setHealth] = useState(null);
  const [activeRecording, setActiveRecording] = useState(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [seekTime, setSeekTime] = useState(null);
  const [loadingRecording, setLoadingRecording] = useState(false);
  const [inputMode, setInputMode] = useState('upload'); // upload, record

  // Modals
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showSpeakerModal, setShowSpeakerModal] = useState(false);
  const [showAIInfoModal, setShowAIInfoModal] = useState(false);
  const [currentError, setCurrentError] = useState(null);

  // Fetch health on mount
  const checkHealth = useCallback(async () => {
    try {
      const data = await api.getHealth();
      setHealth(data);
    } catch (err) {
      console.warn("Backend health check failed:", err);
    }
  }, []);

  // Fetch initial latest recording if exists
  const loadLatestRecording = useCallback(async () => {
    try {
      const list = await api.listRecordings();
      if (list && list.length > 0) {
        const latest = await api.getRecordingDetail(list[0].id);
        setActiveRecording(latest);
      }
    } catch (err) {
      console.warn("Could not load initial recording:", err);
    }
  }, []);

  useEffect(() => {
    checkHealth();
    loadLatestRecording();
  }, [checkHealth, loadLatestRecording]);

  // Load specific recording by ID
  const selectRecording = async (recordingId) => {
    setLoadingRecording(true);
    try {
      const detail = await api.getRecordingDetail(recordingId);
      setActiveRecording(detail);
      setShowHistoryModal(false);
      setShowUploadModal(false);
      setCurrentTime(0);
      setSeekTime(null);
    } catch (err) {
      setCurrentError(err);
    } finally {
      setLoadingRecording(false);
    }
  };

  // Refresh active recording data (e.g. after speaker update or re-summarise)
  const refreshActiveRecording = async () => {
    if (!activeRecording?.id) return;
    try {
      const detail = await api.getRecordingDetail(activeRecording.id);
      setActiveRecording(detail);
    } catch (err) {
      console.error("Refresh recording error:", err);
    }
  };

  // Trigger summarisation manually
  const handleRegenerateSummary = async (customInstructions = null) => {
    if (!activeRecording?.id) return;
    try {
      await api.summarizeRecording(activeRecording.id, customInstructions);
      await refreshActiveRecording();
    } catch (err) {
      setCurrentError(err);
      await refreshActiveRecording(); // Refresh to ensure failed status is captured
    }
  };

  // Seek handler from transcript segments or summary task jumpers
  const handleSeek = (timeSec) => {
    setSeekTime(timeSec);
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-primary)', display: 'flex', flexDirection: 'column' }}>
      {/* Top Header */}
      <Header
        health={health}
        activeRecording={activeRecording}
        onOpenUpload={() => setShowUploadModal(true)}
        onOpenHistory={() => setShowHistoryModal(true)}
        onOpenAIInfo={() => setShowAIInfoModal(true)}
      />

      {/* Main Content Area */}
      <main style={{ flex: 1, maxWidth: '1400px', margin: '0 auto', padding: '1.5rem 1rem', width: '100%' }}>
        {/* If no recording active, or hero section */}
        {!activeRecording ? (
          <div>
            <HeroWorkflow onStartNew={() => setShowUploadModal(true)} />

            {/* Inline Action Card */}
            <div style={{ maxWidth: '700px', margin: '0 auto' }}>
              <div style={{
                display: 'flex',
                gap: '0.5rem',
                marginBottom: '1rem',
                borderBottom: '2px solid var(--color-ink)',
                paddingBottom: '0px'
              }}>
                <button
                  onClick={() => setInputMode('upload')}
                  className={inputMode === 'upload' ? 'btn-burgundy btn-sm' : 'btn-secondary btn-sm'}
                  style={{ borderRadius: '4px 4px 0 0', marginBottom: '-2px' }}
                >
                  <UploadCloud size={15} />
                  <span>Upload Audio File</span>
                </button>

                <button
                  onClick={() => setInputMode('record')}
                  className={inputMode === 'record' ? 'btn-burgundy btn-sm' : 'btn-secondary btn-sm'}
                  style={{ borderRadius: '4px 4px 0 0', marginBottom: '-2px' }}
                >
                  <Mic size={15} />
                  <span>Record Microphone</span>
                </button>
              </div>

              {inputMode === 'upload' ? (
                <AudioUploader
                  onUploadSuccess={(rec) => {
                    setActiveRecording(rec);
                    setShowUploadModal(false);
                  }}
                  onError={(err, status) => setCurrentError({ message: err, status })}
                />
              ) : (
                <AudioRecorder
                  onRecordingComplete={(rec) => {
                    setActiveRecording(rec);
                    setShowUploadModal(false);
                  }}
                  onError={(err) => setCurrentError({ message: err })}
                />
              )}
            </div>
          </div>
        ) : (
          /* Active Recording Workspace */
          <div>
            {/* Top Meeting Title Bar */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '0.75rem',
              backgroundColor: 'var(--bg-card)',
              border: '2px solid var(--color-ink)',
              borderRadius: '4px',
              padding: '1rem 1.25rem',
              marginBottom: '1.25rem',
              boxShadow: 'var(--shadow-solid)'
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <h2 className="font-serif" style={{ fontSize: '1.4rem', color: 'var(--color-ink)' }}>
                    {activeRecording.original_filename}
                  </h2>
                  <span className={activeRecording.status === 'completed' ? 'chip-status-ok' : (activeRecording.status === 'error' ? 'chip-status-burgundy' : 'chip-status-amber')}>
                    {activeRecording.status}
                  </span>
                </div>
                <p style={{ fontSize: '0.78rem', color: 'var(--color-ink-muted)', marginTop: '2px' }}>
                  Processed with Groq Whisper Large v3 Turbo & Llama 3.3 70B • Backend Database ID: {activeRecording.id}
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <button
                  onClick={() => setShowSpeakerModal(true)}
                  className="btn-secondary btn-sm"
                >
                  <span>Speakers ({activeRecording.speakers?.length || 0})</span>
                </button>

                <button
                  onClick={() => setShowUploadModal(true)}
                  className="btn-burgundy btn-sm"
                >
                  <Mic size={14} />
                  <span>+ New Audio</span>
                </button>
              </div>
            </div>

            {/* Audio Player */}
            <AudioPlayer
              audioUrl={api.getAudioUrl(activeRecording.id)}
              onTimeUpdate={setCurrentTime}
              seekTime={seekTime}
              title={activeRecording.original_filename}
            />

            {/* 2-Column Split: Left Transcript / Right Structured Summary */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(320px, 1fr) minmax(360px, 1.15fr)',
              gap: '1.5rem',
              alignItems: 'start'
            }}>
              {/* Left: Transcript View */}
              <div>
                <TranscriptView
                  recordingId={activeRecording.id}
                  segments={activeRecording.segments || []}
                  speakers={activeRecording.speakers || []}
                  currentTime={currentTime}
                  onSeek={handleSeek}
                  onSpeakerAssigned={refreshActiveRecording}
                  onOpenSpeakerManager={() => setShowSpeakerModal(true)}
                />
              </div>

              {/* Right: Summary View */}
              <div>
                <SummaryView
                  recordingId={activeRecording.id}
                  summary={activeRecording.summary}
                  summaryStatus={activeRecording.summary_status}
                  summaryError={activeRecording.summary_error}
                  segments={activeRecording.segments || []}
                  onSeekSegment={handleSeek}
                  onRegenerateSummary={handleRegenerateSummary}
                />
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer style={{
        borderTop: '2px solid var(--color-ink)',
        backgroundColor: 'var(--bg-card)',
        padding: '1.25rem 1rem',
        marginTop: '3rem',
        textAlign: 'center',
        fontSize: '0.82rem',
        color: 'var(--color-ink-muted)'
      }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <strong style={{ color: 'var(--color-ink)' }}>Vartalaap v2.0</strong> — Groq-Powered Speech & Intelligence Engine
          </div>
          <div>
            External AI processing handled strictly via Groq Cloud APIs (whisper-large-v3-turbo & llama-3.3-70b-versatile).
          </div>
        </div>
      </footer>

      {/* Modals & Drawers */}
      {showUploadModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(26, 24, 23, 0.65)',
          backdropFilter: 'blur(2px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '1rem'
        }}>
          <div style={{ width: '100%', maxWidth: '600px' }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.5rem' }}>
              <button
                onClick={() => setShowUploadModal(false)}
                className="btn-secondary btn-sm"
              >
                Close ✕
              </button>
            </div>

            <div style={{
              display: 'flex',
              gap: '0.5rem',
              marginBottom: '0.5rem',
              borderBottom: '2px solid var(--color-ink)',
              paddingBottom: '0px'
            }}>
              <button
                onClick={() => setInputMode('upload')}
                className={inputMode === 'upload' ? 'btn-burgundy btn-sm' : 'btn-secondary btn-sm'}
              >
                <UploadCloud size={15} />
                <span>Upload Audio</span>
              </button>
              <button
                onClick={() => setInputMode('record')}
                className={inputMode === 'record' ? 'btn-burgundy btn-sm' : 'btn-secondary btn-sm'}
              >
                <Mic size={15} />
                <span>Microphone</span>
              </button>
            </div>

            {inputMode === 'upload' ? (
              <AudioUploader
                onUploadSuccess={(rec) => {
                  setActiveRecording(rec);
                  setShowUploadModal(false);
                }}
                onError={(err, status) => setCurrentError({ message: err, status })}
              />
            ) : (
              <AudioRecorder
                onRecordingComplete={(rec) => {
                  setActiveRecording(rec);
                  setShowUploadModal(false);
                }}
                onError={(err) => setCurrentError({ message: err })}
              />
            )}
          </div>
        </div>
      )}

      {showHistoryModal && (
        <RecordingsList
          activeRecordingId={activeRecording?.id}
          onSelectRecording={selectRecording}
          onClose={() => setShowHistoryModal(false)}
          onDeleteRecording={(deletedId) => {
            if (activeRecording?.id === deletedId) {
              setActiveRecording(null);
            }
          }}
        />
      )}

      {showSpeakerModal && activeRecording && (
        <SpeakerManager
          recordingId={activeRecording.id}
          speakers={activeRecording.speakers || []}
          onSpeakerCreated={refreshActiveRecording}
          onSpeakerDeleted={refreshActiveRecording}
          onClose={() => setShowSpeakerModal(false)}
        />
      )}

      {showAIInfoModal && (
        <ModelInspector
          health={health}
          onClose={() => setShowAIInfoModal(false)}
        />
      )}

      {currentError && (
        <ErrorModal
          error={currentError}
          onClose={() => setCurrentError(null)}
          onRetry={() => {
            setCurrentError(null);
            checkHealth();
            if (activeRecording) refreshActiveRecording();
          }}
        />
      )}
    </div>
  );
}
