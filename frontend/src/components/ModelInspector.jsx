import React from 'react';
import { X, Sparkles, ShieldCheck, Zap, Database, Key, CheckCircle, AlertTriangle } from 'lucide-react';
import { GROQ_CONFIG } from '../utils/constants';

export default function ModelInspector({ health, onClose }) {
  return (
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
      <div className="retro-card" style={{
        width: '100%',
        maxWidth: '580px',
        backgroundColor: 'var(--bg-card)',
        padding: '1.5rem',
        boxShadow: 'var(--shadow-solid-lg)'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '2px solid var(--color-ink)', paddingBottom: '0.75rem', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Sparkles size={20} style={{ color: 'var(--color-burgundy)' }} />
            <h3 className="font-serif" style={{ fontSize: '1.3rem', color: 'var(--color-ink)' }}>
              External AI Provider & Architecture
            </h3>
          </div>
          <button
            onClick={onClose}
            className="btn-secondary btn-sm"
            style={{ padding: '0.25rem 0.5rem' }}
          >
            <X size={16} />
          </button>
        </div>

        {/* AI Provider Notice Box */}
        <div style={{
          backgroundColor: 'var(--bg-primary)',
          border: '2px solid var(--color-ink)',
          borderRadius: '4px',
          padding: '1rem',
          marginBottom: '1.25rem',
          boxShadow: 'var(--shadow-solid-sm)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
            <ShieldCheck size={18} style={{ color: 'var(--color-burgundy)' }} />
            <span style={{ fontWeight: 800, fontSize: '0.92rem', color: 'var(--color-burgundy)' }}>
              External AI Processing Disclosure
            </span>
          </div>
          <p style={{ fontSize: '0.85rem', lineHeight: 1.5, color: 'var(--color-ink)' }}>
            Uploaded audio recordings and generated transcripts are securely processed externally via <strong style={{ color: 'var(--color-burgundy)' }}>Groq Cloud AI APIs</strong> using high-performance specialized LPU inference engines.
          </p>
        </div>

        {/* Models & Limits Grid */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.25rem' }}>
          {/* Whisper */}
          <div style={{
            backgroundColor: '#FFFFFF',
            border: '1.5px solid var(--color-ink)',
            borderRadius: '4px',
            padding: '0.75rem 1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-ink-muted)', textTransform: 'uppercase' }}>
                Speech Transcription Engine
              </span>
              <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--color-ink)' }}>
                {health?.transcription_model || GROQ_CONFIG.TRANSCRIPTION_MODEL}
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--color-ink-muted)' }}>
                verbose_json format with segment-level timestamps
              </span>
            </div>
            <span className="chip-status-ok" style={{ fontSize: '0.7rem' }}>Official Groq</span>
          </div>

          {/* Llama */}
          <div style={{
            backgroundColor: '#FFFFFF',
            border: '1.5px solid var(--color-ink)',
            borderRadius: '4px',
            padding: '0.75rem 1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-ink-muted)', textTransform: 'uppercase' }}>
                LLM Structured Summarisation
              </span>
              <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--color-ink)' }}>
                {health?.summary_model || GROQ_CONFIG.SUMMARY_MODEL}
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--color-ink-muted)' }}>
                Strict Pydantic JSON validation & segment citation
              </span>
            </div>
            <span className="chip-status-ok" style={{ fontSize: '0.7rem' }}>Configurable</span>
          </div>

          {/* Key & Limits */}
          <div style={{
            backgroundColor: '#FFFFFF',
            border: '1.5px solid var(--color-ink)',
            borderRadius: '4px',
            padding: '0.75rem 1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-ink-muted)', textTransform: 'uppercase' }}>
                Backend API Key Security
              </span>
              <div style={{ fontSize: '0.88rem', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                {health?.has_groq_api_key ? (health.api_key_masked || 'GROQ_API_KEY Configured') : 'No GROQ_API_KEY Found'}
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--color-ink-muted)' }}>
                Backend-only storage in .env (never exposed to frontend)
              </span>
            </div>
            {health?.has_groq_api_key ? (
              <span className="chip-status-ok" style={{ fontSize: '0.7rem' }}>Protected</span>
            ) : (
              <span className="chip-status-burgundy" style={{ fontSize: '0.7rem' }}>Action Required</span>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{ textAlign: 'right' }}>
          <button onClick={onClose} className="btn-secondary btn-sm">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
