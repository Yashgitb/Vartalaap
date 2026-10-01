import React, { useState } from 'react';
import { X, Plus, Trash2, User, Palette, Shield } from 'lucide-react';
import { api } from '../api/client';
import { SPEAKER_COLORS } from '../utils/constants';

export default function SpeakerManager({
  recordingId,
  speakers = [],
  onSpeakerCreated,
  onSpeakerDeleted,
  onClose
}) {
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [selectedColor, setSelectedColor] = useState(SPEAKER_COLORS[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Speaker name is required');
      return;
    }
    setError(null);
    setLoading(true);

    try {
      await api.createSpeaker(recordingId, name.trim(), role.trim() || null, selectedColor);
      setName('');
      setRole('');
      setSelectedColor(SPEAKER_COLORS[(speakers.length + 1) % SPEAKER_COLORS.length]);
      if (onSpeakerCreated) onSpeakerCreated();
    } catch (err) {
      setError(err.message || 'Failed to create speaker');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (speakerId) => {
    if (!window.confirm('Remove this speaker? Any assigned segments will become unassigned.')) return;
    try {
      await api.deleteSpeaker(recordingId, speakerId);
      if (onSpeakerDeleted) onSpeakerDeleted();
    } catch (err) {
      console.error('Delete speaker error:', err);
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
        maxWidth: '520px',
        backgroundColor: 'var(--bg-card)',
        padding: '1.5rem',
        boxShadow: 'var(--shadow-solid-lg)'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '2px solid var(--color-ink)', paddingBottom: '0.75rem', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <User size={20} style={{ color: 'var(--color-burgundy)' }} />
            <h3 className="font-serif" style={{ fontSize: '1.25rem', color: 'var(--color-ink)' }}>
              Speaker Attribution Roster
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

        {/* Informational note about manual attribution */}
        <div style={{
          backgroundColor: 'var(--bg-primary)',
          border: '1.5px solid var(--color-border-light)',
          borderRadius: '4px',
          padding: '0.65rem 0.85rem',
          fontSize: '0.78rem',
          color: 'var(--color-ink-muted)',
          marginBottom: '1.25rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.4rem'
        }}>
          <Shield size={16} style={{ color: 'var(--color-burgundy)', flexShrink: 0 }} />
          <span>
            Groq Whisper produces raw transcripts without automated diarisation. Define human speakers here and assign segments manually to prevent identity hallucinations.
          </span>
        </div>

        {/* Add New Speaker Form */}
        <form onSubmit={handleCreate} style={{
          backgroundColor: 'var(--bg-primary)',
          border: '2px solid var(--color-ink)',
          borderRadius: '4px',
          padding: '1rem',
          marginBottom: '1.25rem'
        }}>
          <h4 className="font-serif" style={{ fontSize: '0.95rem', color: 'var(--color-ink)', marginBottom: '0.65rem' }}>
            Add New Speaker
          </h4>

          {error && (
            <p style={{ color: 'var(--color-burgundy)', fontSize: '0.78rem', fontWeight: 700, marginBottom: '0.5rem' }}>
              {error}
            </p>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem', marginBottom: '0.75rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, marginBottom: '0.2rem' }}>
                Speaker Name *
              </label>
              <input
                type="text"
                placeholder="e.g. Rahul Sharma"
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.45rem 0.65rem',
                  border: '1.5px solid var(--color-ink)',
                  borderRadius: '3px',
                  fontSize: '0.85rem',
                  backgroundColor: '#FFFFFF'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, marginBottom: '0.2rem' }}>
                Role / Title
              </label>
              <input
                type="text"
                placeholder="e.g. Lead Architect"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.45rem 0.65rem',
                  border: '1.5px solid var(--color-ink)',
                  borderRadius: '3px',
                  fontSize: '0.85rem',
                  backgroundColor: '#FFFFFF'
                }}
              />
            </div>
          </div>

          {/* Color Palette Picker */}
          <div style={{ marginBottom: '0.85rem' }}>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, marginBottom: '0.35rem' }}>
              Badge Color:
            </label>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {SPEAKER_COLORS.map(c => (
                <button
                  type="button"
                  key={c}
                  onClick={() => setSelectedColor(c)}
                  style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '3px',
                    backgroundColor: c,
                    border: selectedColor === c ? '2.5px solid var(--color-ink)' : '1px solid rgba(0,0,0,0.2)',
                    cursor: 'pointer',
                    transform: selectedColor === c ? 'scale(1.15)' : 'none',
                    boxShadow: selectedColor === c ? '1px 1px 0px var(--color-ink)' : 'none'
                  }}
                />
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-burgundy btn-sm"
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}
          >
            <Plus size={14} />
            <span>Add Speaker</span>
          </button>
        </form>

        {/* Existing Speakers Roster */}
        <div>
          <h4 className="font-serif" style={{ fontSize: '0.95rem', color: 'var(--color-ink)', marginBottom: '0.5rem' }}>
            Current Roster ({speakers.length})
          </h4>

          {speakers.length === 0 ? (
            <p style={{ fontSize: '0.82rem', color: 'var(--color-ink-muted)', textAlign: 'center', padding: '1rem', backgroundColor: 'var(--bg-primary)', borderRadius: '4px' }}>
              No custom speakers added yet. Segments are currently unassigned.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', maxHeight: '180px', overflowY: 'auto' }}>
              {speakers.map(s => (
                <div
                  key={s.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    backgroundColor: '#FFFFFF',
                    border: '1.5px solid var(--color-border-light)',
                    borderRadius: '4px',
                    padding: '0.45rem 0.75rem'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <div style={{
                      width: '18px',
                      height: '18px',
                      borderRadius: '3px',
                      backgroundColor: s.color,
                      border: '1px solid var(--color-ink)'
                    }} />
                    <span style={{ fontWeight: 700, fontSize: '0.88rem' }}>{s.name}</span>
                    {s.role && (
                      <span style={{ fontSize: '0.75rem', color: 'var(--color-ink-muted)' }}>
                        ({s.role})
                      </span>
                    )}
                  </div>

                  <button
                    onClick={() => handleDelete(s.id)}
                    style={{
                      border: 'none',
                      background: 'none',
                      color: 'var(--color-burgundy)',
                      cursor: 'pointer',
                      padding: '0.2rem'
                    }}
                    title="Delete Speaker"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Close */}
        <div style={{ marginTop: '1.25rem', textAlign: 'right' }}>
          <button onClick={onClose} className="btn-secondary btn-sm">
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
