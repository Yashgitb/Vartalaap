import React from 'react';
import { Mic, Radio, ShieldCheck, Sparkles, Key, FileText, Info, History } from 'lucide-react';

export default function Header({ health, onOpenHistory, onOpenUpload, onOpenAIInfo, activeRecording }) {
  return (
    <header style={{
      borderBottom: '2px solid var(--color-ink)',
      backgroundColor: 'var(--bg-card)',
      padding: '0.85rem 1.5rem',
      position: 'sticky',
      top: 0,
      zIndex: 100,
      boxShadow: '0 2px 0px rgba(0,0,0,0.05)'
    }}>
      <div style={{
        maxWidth: '1400px',
        margin: '0 auto',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        {/* Brand Logo & Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div style={{
            backgroundColor: 'var(--color-burgundy)',
            color: '#FFFFFF',
            width: '40px',
            height: '40px',
            borderRadius: '4px',
            border: '2px solid var(--color-ink)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '2px 2px 0px var(--color-ink)'
          }}>
            <Radio size={22} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span className="font-serif" style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--color-ink)', letterSpacing: '-0.02em' }}>
                Vartalaap
              </span>
              
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--color-ink-muted)', marginTop: '-2px' }}>
              Speech Transcription & Meeting Intelligence
            </p>
          </div>
        </div>

        {/* Center: External AI Provider Notice */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.6rem',
          backgroundColor: 'var(--bg-primary)',
          border: '1.5px solid var(--color-border-light)',
          padding: '0.35rem 0.85rem',
          borderRadius: '4px',
          fontSize: '0.78rem'
        }}>
          
          
          <div style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: health?.has_groq_api_key ? 'var(--color-green)' : 'var(--color-amber)',
            border: '1px solid var(--color-ink)'
          }} />
        </div>

        {/* Right Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <button
            onClick={onOpenAIInfo}
            className="btn-secondary btn-sm"
            title="External AI Provider & Models Disclosure"
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <Info size={15} />
            <span>AI Info</span>
          </button>

          <button
            onClick={onOpenHistory}
            className="btn-secondary btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <History size={15} />
            <span>Meetings</span>
          </button>

          <button
            onClick={onOpenUpload}
            className="btn-burgundy btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <Mic size={15} />
            <span>+ New Recording</span>
          </button>
        </div>
      </div>
    </header>
  );
}
