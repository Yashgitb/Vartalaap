import React from 'react';
import { AlertCircle, X, Key, UploadCloud, RefreshCw, Zap } from 'lucide-react';

export default function ErrorModal({ error, onClose, onRetry }) {
  if (!error) return null;

  const errorMessage = typeof error === 'string' ? error : (error.message || 'An error occurred.');
  const statusCode = error.status || (errorMessage.includes('413') ? 413 : (errorMessage.includes('429') ? 429 : (errorMessage.includes('401') ? 401 : null)));

  let title = "Error Encountered";
  let icon = <AlertCircle size={24} style={{ color: 'var(--color-burgundy)' }} />;
  let suggestion = "Please check your network and try again.";

  if (statusCode === 413 || errorMessage.toLowerCase().includes('25mb') || errorMessage.toLowerCase().includes('exceeds')) {
    title = "File Size Exceeds Groq Limits (25MB)";
    icon = <UploadCloud size={24} style={{ color: 'var(--color-burgundy)' }} />;
    suggestion = "Groq's audio transcription endpoint supports audio files up to 25MB. Please upload a shorter audio recording or compress the file.";
  } else if (statusCode === 429 || errorMessage.toLowerCase().includes('rate limit')) {
    title = "Groq API Rate Limit Reached";
    icon = <Zap size={24} style={{ color: 'var(--color-amber)' }} />;
    suggestion = "You have hit the Groq Cloud rate limit for your current tier. Please wait 10-30 seconds before retrying.";
  } else if (statusCode === 401 || errorMessage.toLowerCase().includes('api key') || errorMessage.toLowerCase().includes('authentication')) {
    title = "Groq API Key Required";
    icon = <Key size={24} style={{ color: 'var(--color-burgundy)' }} />;
    suggestion = "Please open the .env file in your Vartalaap backend directory and set your GROQ_API_KEY=gsk_... from console.groq.com.";
  }

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(26, 24, 23, 0.65)',
      backdropFilter: 'blur(2px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1100,
      padding: '1rem'
    }}>
      <div className="retro-card" style={{
        width: '100%',
        maxWidth: '500px',
        backgroundColor: 'var(--bg-card)',
        padding: '1.5rem',
        boxShadow: 'var(--shadow-solid-lg)',
        border: '2px solid var(--color-burgundy)'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            {icon}
            <h3 className="font-serif" style={{ fontSize: '1.2rem', color: 'var(--color-burgundy)' }}>
              {title}
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

        {/* Message */}
        <div style={{
          backgroundColor: 'var(--color-burgundy-light)',
          border: '1.5px solid var(--color-burgundy)',
          borderRadius: '4px',
          padding: '0.85rem 1rem',
          fontSize: '0.88rem',
          color: 'var(--color-ink)',
          marginBottom: '1rem'
        }}>
          {errorMessage}
        </div>

        {/* Actionable Suggestion */}
        <div style={{
          backgroundColor: 'var(--bg-primary)',
          border: '1.5px solid var(--color-border-light)',
          borderRadius: '4px',
          padding: '0.75rem 1rem',
          fontSize: '0.82rem',
          color: 'var(--color-ink-muted)',
          marginBottom: '1.25rem'
        }}>
          <strong>Guidance:</strong> {suggestion}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.65rem' }}>
          <button onClick={onClose} className="btn-secondary btn-sm">
            Dismiss
          </button>
          {onRetry && (
            <button onClick={onRetry} className="btn-burgundy btn-sm">
              <RefreshCw size={14} />
              <span>Retry Request</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
