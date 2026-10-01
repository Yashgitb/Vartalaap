import React, { useState, useEffect } from 'react';
import { History, X, Trash2, Play, FileAudio, Calendar, Clock, HardDrive, RefreshCw } from 'lucide-react';
import { api } from '../api/client';
import { formatSeconds, formatBytes, formatDate } from '../utils/formatters';

export default function RecordingsList({
  activeRecordingId,
  onSelectRecording,
  onClose,
  onDeleteRecording
}) {
  const [recordings, setRecordings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadList = async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await api.listRecordings();
      setRecordings(list);
    } catch (err) {
      setError(err.message || 'Failed to load recordings list');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadList();
  }, []);

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this recording and all associated transcripts?')) return;
    try {
      await api.deleteRecording(id);
      setRecordings(prev => prev.filter(r => r.id !== id));
      if (onDeleteRecording) onDeleteRecording(id);
    } catch (err) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  const getStatusChip = (status) => {
    switch (status) {
      case 'completed':
        return <span className="chip-status-ok">Summarised</span>;
      case 'transcribed':
        return <span className="chip-status-ok" style={{ borderColor: 'var(--color-ink-muted)', color: 'var(--color-ink-muted)', backgroundColor: 'var(--bg-secondary)' }}>Transcribed</span>;
      case 'transcribing':
      case 'summarizing':
        return <span className="chip-status-amber animate-pulse-subtle">Processing...</span>;
      case 'error':
        return <span className="chip-status-burgundy">Error</span>;
      default:
        return <span className="chip-status-amber">Uploaded</span>;
    }
  };

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
        maxWidth: '680px',
        backgroundColor: 'var(--bg-card)',
        padding: '1.5rem',
        boxShadow: 'var(--shadow-solid-lg)',
        maxHeight: '85vh',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '2px solid var(--color-ink)', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <History size={20} style={{ color: 'var(--color-burgundy)' }} />
            <h3 className="font-serif" style={{ fontSize: '1.3rem', color: 'var(--color-ink)' }}>
              Saved Conversations & Meetings ({recordings.length})
            </h3>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              onClick={loadList}
              className="btn-secondary btn-sm"
              style={{ padding: '0.25rem 0.5rem' }}
              title="Refresh list"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={onClose}
              className="btn-secondary btn-sm"
              style={{ padding: '0.25rem 0.5rem' }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Content List */}
        <div style={{ flex: 1, overflowY: 'auto', paddingRight: '0.25rem', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--color-ink-muted)' }}>
              <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 0.5rem auto', color: 'var(--color-burgundy)' }} />
              <p>Loading database recordings...</p>
            </div>
          ) : error ? (
            <div style={{ padding: '1rem', backgroundColor: 'var(--color-burgundy-light)', border: '1px solid var(--color-burgundy)', borderRadius: '4px', color: 'var(--color-burgundy)' }}>
              {error}
            </div>
          ) : recordings.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--color-ink-muted)' }}>
              <FileAudio size={36} style={{ margin: '0 auto 0.75rem auto', opacity: 0.5 }} />
              <p style={{ fontWeight: 700 }}>No audio recordings saved yet.</p>
              <p style={{ fontSize: '0.82rem', marginTop: '0.25rem' }}>Upload or record an audio conversation to get started.</p>
            </div>
          ) : (
            recordings.map((r) => {
              const isActive = r.id === activeRecordingId;
              return (
                <div
                  key={r.id}
                  onClick={() => onSelectRecording(r.id)}
                  style={{
                    backgroundColor: isActive ? 'var(--bg-secondary)' : '#FFFFFF',
                    border: `2px solid ${isActive ? 'var(--color-burgundy)' : 'var(--color-border-light)'}`,
                    borderRadius: '4px',
                    padding: '0.85rem 1rem',
                    cursor: 'pointer',
                    boxShadow: isActive ? 'var(--shadow-solid-sm)' : 'none',
                    transition: 'all 0.1s ease',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '1rem'
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                      <span style={{
                        fontWeight: 800,
                        fontSize: '0.95rem',
                        color: 'var(--color-ink)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}>
                        {r.original_filename}
                      </span>
                      {getStatusChip(r.status)}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.75rem', color: 'var(--color-ink-muted)', flexWrap: 'wrap' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <Clock size={12} />
                        <span>{formatSeconds(r.duration_seconds)}</span>
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <HardDrive size={12} />
                        <span>{formatBytes(r.file_size_bytes)}</span>
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <Calendar size={12} />
                        <span>{formatDate(r.created_at)}</span>
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <button
                      onClick={(e) => { e.stopPropagation(); onSelectRecording(r.id); }}
                      className="btn-burgundy btn-sm"
                      style={{ padding: '0.35rem 0.65rem' }}
                    >
                      <Play size={13} />
                      <span>Open</span>
                    </button>
                    <button
                      onClick={(e) => handleDelete(r.id, e)}
                      className="btn-secondary btn-sm"
                      style={{ padding: '0.35rem 0.5rem', color: 'var(--color-burgundy)' }}
                      title="Delete recording"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1.5px solid var(--color-border-light)', textAlign: 'right' }}>
          <button onClick={onClose} className="btn-secondary btn-sm">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
