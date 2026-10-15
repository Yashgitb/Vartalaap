import React from 'react';
import { Mic, Radio, History, Home } from 'lucide-react';

export default function Header({ health, onOpenHistory, onOpenUpload, activeRecording, onGoHome }) {
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
        <div
          onClick={onGoHome}
          style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', cursor: onGoHome ? 'pointer' : 'default' }}
          title="Return to Home Page"
        >
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

        {/* Right Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          {activeRecording && (
            <button
              onClick={onGoHome}
              className="btn-secondary btn-sm"
              title="Return to Home Page"
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <Home size={15} />
              <span>Home</span>
            </button>
          )}

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
