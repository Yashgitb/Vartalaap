import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Play, Pause, RefreshCw, Send, AlertCircle, Sparkles } from 'lucide-react';
import { api } from '../api/client';
import { formatSeconds } from '../utils/formatters';

export default function AudioRecorder({ onRecordingComplete, onError }) {
  const [recordingState, setRecordingState] = useState('idle'); // idle, recording, paused, stopped
  const [recordTime, setRecordTime] = useState(0);
  const [audioUrl, setAudioUrl] = useState(null);
  const [audioBlob, setAudioBlob] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerIntervalRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const animationFrameRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
    };
  }, []);

  const drawWaveform = () => {
    if (!canvasRef.current || !analyserRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const analyser = analyserRef.current;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const render = () => {
      animationFrameRef.current = requestAnimationFrame(render);
      analyser.getByteFrequencyData(dataArray);

      ctx.fillStyle = '#FAF6F0';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const barWidth = (canvas.width / bufferLength) * 2.5;
      let barHeight;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        barHeight = (dataArray[i] / 255) * canvas.height * 0.9;

        // Gradient or Burgundy bars
        ctx.fillStyle = '#8B2635';
        ctx.fillRect(x, (canvas.height - barHeight) / 2, barWidth, Math.max(barHeight, 2));

        x += barWidth + 2;
      }
    };
    render();
  };

  const startRecording = async () => {
    try {
      audioChunksRef.current = [];
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Setup audio analyzer for waveform
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      audioContextRef.current = new AudioCtx();
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 64;
      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyserRef.current);
      drawWaveform();

      // Setup MediaRecorder
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';
      
      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        setAudioBlob(blob);
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        stream.getTracks().forEach((track) => track.stop());
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      };

      recorder.start(500);
      setRecordingState('recording');
      setRecordTime(0);

      timerIntervalRef.current = setInterval(() => {
        setRecordTime((prev) => prev + 1);
      }, 1000);

    } catch (err) {
      console.error("Microphone access error:", err);
      if (onError) onError("Microphone access was denied or is unavailable. Please grant browser mic permissions.");
    }
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current && recordingState === 'recording') {
      mediaRecorderRef.current.pause();
      setRecordingState('paused');
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    }
  };

  const resumeRecording = () => {
    if (mediaRecorderRef.current && recordingState === 'paused') {
      mediaRecorderRef.current.resume();
      setRecordingState('recording');
      timerIntervalRef.current = setInterval(() => {
        setRecordTime((prev) => prev + 1);
      }, 1000);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && (recordingState === 'recording' || recordingState === 'paused')) {
      mediaRecorderRef.current.stop();
      setRecordingState('stopped');
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    }
  };

  const resetRecording = () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setRecordingState('idle');
    setRecordTime(0);
    setAudioBlob(null);
    setAudioUrl(null);
  };

  const handleTranscribeRecorded = async () => {
    if (!audioBlob) return;
    setSubmitting(true);
    try {
      const now = new Date();
      const filename = `meeting_mic_${now.toISOString().slice(0,10)}_${now.getHours()}${now.getMinutes()}.webm`;
      const file = new File([audioBlob], filename, { type: audioBlob.type || 'audio/webm' });

      const res = await api.uploadAudio(file, true, true);
      onRecordingComplete(res);
      resetRecording();
    } catch (err) {
      console.error("Upload recorded audio error:", err);
      if (onError) onError(err.message || "Failed to transcribe recording.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="retro-card" style={{ padding: '1.5rem', backgroundColor: 'var(--bg-card)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <h3 className="font-serif" style={{ fontSize: '1.25rem', color: 'var(--color-ink)' }}>
          Direct Microphone Recording
        </h3>
        {recordingState === 'recording' && (
          <span className="chip-status-burgundy animate-pulse-subtle">
            ● LIVE RECORDING
          </span>
        )}
      </div>

      {/* Waveform Canvas & Timer */}
      <div style={{
        backgroundColor: 'var(--bg-primary)',
        border: '2px solid var(--color-ink)',
        borderRadius: '4px',
        padding: '1.5rem',
        textAlign: 'center',
        marginBottom: '1.25rem',
        boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.05)'
      }}>
        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '2.5rem',
          fontWeight: 800,
          color: recordingState === 'recording' ? 'var(--color-burgundy)' : 'var(--color-ink)',
          marginBottom: '0.75rem'
        }}>
          {formatSeconds(recordTime)}
        </div>

        <canvas
          ref={canvasRef}
          width={400}
          height={60}
          style={{
            width: '100%',
            maxWidth: '450px',
            height: '60px',
            backgroundColor: '#FAF6F0',
            borderRadius: '4px',
            border: '1.5px solid var(--color-border-light)',
            display: 'block',
            margin: '0 auto'
          }}
        />
      </div>

      {/* Recorded Audio Preview */}
      {audioUrl && (
        <div style={{ marginBottom: '1.25rem' }}>
          <p style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.4rem' }}>
            Preview Recording:
          </p>
          <audio controls src={audioUrl} style={{ width: '100%' }} />
        </div>
      )}

      {/* Controls Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
        {recordingState === 'idle' && (
          <button
            type="button"
            className="btn-burgundy"
            onClick={startRecording}
            style={{ padding: '0.75rem 1.75rem' }}
          >
            <Mic size={18} />
            <span>Start Microphone</span>
          </button>
        )}

        {recordingState === 'recording' && (
          <>
            <button
              type="button"
              className="btn-secondary"
              onClick={pauseRecording}
            >
              <Pause size={18} />
              <span>Pause</span>
            </button>
            <button
              type="button"
              className="btn-burgundy"
              onClick={stopRecording}
            >
              <Square size={18} />
              <span>Stop & Finish</span>
            </button>
          </>
        )}

        {recordingState === 'paused' && (
          <>
            <button
              type="button"
              className="btn-secondary"
              onClick={resumeRecording}
            >
              <Play size={18} />
              <span>Resume</span>
            </button>
            <button
              type="button"
              className="btn-burgundy"
              onClick={stopRecording}
            >
              <Square size={18} />
              <span>Stop & Finish</span>
            </button>
          </>
        )}

        {recordingState === 'stopped' && (
          <>
            <button
              type="button"
              className="btn-secondary"
              onClick={resetRecording}
              disabled={submitting}
            >
              <RefreshCw size={16} />
              <span>Re-record</span>
            </button>
            <button
              type="button"
              className="btn-burgundy"
              onClick={handleTranscribeRecorded}
              disabled={submitting}
            >
              <Send size={16} />
              <span>{submitting ? 'Transcribing with Groq...' : 'Transcribe & Summarise'}</span>
            </button>
          </>
        )}
      </div>

      <div style={{
        fontSize: '0.75rem',
        color: 'var(--color-ink-muted)',
        marginTop: '1rem',
        textAlign: 'center',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.4rem'
      }}>
        <Sparkles size={13} style={{ color: 'var(--color-burgundy)' }} />
        <span>Audio sent directly to Groq Whisper v3 Turbo backend endpoint</span>
      </div>
    </div>
  );
}
