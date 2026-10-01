import React, { useState, useMemo } from 'react';
import { Search, UserCheck, UserPlus, Download, Copy, Check, Filter, Clock, Play } from 'lucide-react';
import { api } from '../api/client';
import { formatSeconds } from '../utils/formatters';

export default function TranscriptView({
  recordingId,
  segments = [],
  speakers = [],
  currentTime = 0,
  onSeek,
  onSpeakerAssigned,
  onOpenSpeakerManager
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSpeakerFilter, setSelectedSpeakerFilter] = useState('ALL');
  const [selectedSegmentIds, setSelectedSegmentIds] = useState([]);
  const [batchSpeakerId, setBatchSpeakerId] = useState('');
  const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Find active playing segment index
  const activeSegmentId = useMemo(() => {
    const found = segments.find(s => currentTime >= s.start && currentTime <= s.end);
    return found ? found.id : null;
  }, [segments, currentTime]);

  // Filter segments
  const filteredSegments = useMemo(() => {
    return segments.filter(seg => {
      const matchesSearch = !searchQuery || seg.text.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesSpeaker =
        selectedSpeakerFilter === 'ALL' ||
        (selectedSpeakerFilter === 'UNASSIGNED' && !seg.speaker_id) ||
        seg.speaker_id === selectedSpeakerFilter;
      return matchesSearch && matchesSpeaker;
    });
  }, [segments, searchQuery, selectedSpeakerFilter]);

  // Copy transcript text
  const handleCopyTranscript = () => {
    const text = segments.map(s => `[${formatSeconds(s.start)} - ${formatSeconds(s.end)}] ${s.speaker_name || 'Unassigned'}: ${s.text}`).join('\n\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Single segment speaker change
  const handleSingleSpeakerChange = async (segmentId, e) => {
    const spkId = e.target.value;
    if (spkId === '__NEW__') {
      onOpenSpeakerManager();
      return;
    }
    const spk = speakers.find(s => s.id === spkId);
    const spkName = spk ? spk.name : null;

    try {
      await api.assignSegmentSpeaker(recordingId, segmentId, spkId || null, spkName);
      if (onSpeakerAssigned) onSpeakerAssigned();
    } catch (err) {
      console.error("Failed to assign speaker:", err);
    }
  };

  // Batch speaker assignment
  const handleBatchAssign = async () => {
    if (selectedSegmentIds.length === 0 || !batchSpeakerId) return;
    const spk = speakers.find(s => s.id === batchSpeakerId);
    const spkName = spk ? spk.name : null;

    try {
      await api.batchAssignSpeaker(recordingId, selectedSegmentIds, batchSpeakerId === '__CLEAR__' ? null : batchSpeakerId, batchSpeakerId === '__CLEAR__' ? null : spkName);
      setSelectedSegmentIds([]);
      setBatchSpeakerId('');
      if (onSpeakerAssigned) onSpeakerAssigned();
    } catch (err) {
      console.error("Batch assign error:", err);
    }
  };

  const toggleSelectAll = () => {
    if (selectedSegmentIds.length === filteredSegments.length) {
      setSelectedSegmentIds([]);
    } else {
      setSelectedSegmentIds(filteredSegments.map(s => s.id));
    }
  };

  const toggleSelectSegment = (id) => {
    setSelectedSegmentIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const getSpeakerBadgeStyle = (speakerId) => {
    const spk = speakers.find(s => s.id === speakerId);
    const color = spk?.color || '#8B2635';
    return {
      backgroundColor: `${color}18`,
      color: color,
      border: `1.5px solid ${color}`,
    };
  };

  return (
    <div className="retro-card" style={{ padding: '1.25rem', backgroundColor: 'var(--bg-card)' }}>
      {/* Top Header & Action Row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
        <div>
          <h3 className="font-serif" style={{ fontSize: '1.3rem', color: 'var(--color-ink)' }}>
            Transcript Segments
          </h3>
          <p style={{ fontSize: '0.78rem', color: 'var(--color-ink-muted)' }}>
            {segments.length} Whisper segments • Click timestamps to jump audio
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            onClick={onOpenSpeakerManager}
            className="btn-secondary btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
          >
            <UserPlus size={14} />
            <span>Manage Speakers</span>
          </button>

          <button
            onClick={handleCopyTranscript}
            className="btn-secondary btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
          >
            {copied ? <Check size={14} style={{ color: 'var(--color-green)' }} /> : <Copy size={14} />}
            <span>{copied ? 'Copied!' : 'Copy All'}</span>
          </button>

          {/* Export Dropdown */}
          <div style={{ position: 'relative' }}>
            <select
              className="btn-secondary btn-sm"
              style={{ cursor: 'pointer', outline: 'none' }}
              onChange={(e) => {
                const fmt = e.target.value;
                if (fmt) {
                  window.open(`/api/recordings/${recordingId}/export/${fmt}`, '_blank');
                  e.target.value = '';
                }
              }}
              defaultValue=""
            >
              <option value="" disabled>Export Transcript ▾</option>
              <option value="srt">Export as Subtitles (.SRT)</option>
              <option value="md">Export as Markdown (.MD)</option>
              <option value="txt">Export as Plain Text (.TXT)</option>
              <option value="json">Export as JSON (.JSON)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.65rem',
        flexWrap: 'wrap',
        backgroundColor: 'var(--bg-primary)',
        padding: '0.75rem',
        borderRadius: '4px',
        border: '1.5px solid var(--color-border-light)',
        marginBottom: '1rem'
      }}>
        {/* Search */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.4rem',
          backgroundColor: '#FFFFFF',
          border: '1.5px solid var(--color-ink)',
          borderRadius: '3px',
          padding: '0.35rem 0.65rem',
          flex: 1,
          minWidth: '200px'
        }}>
          <Search size={15} style={{ color: 'var(--color-ink-muted)' }} />
          <input
            type="text"
            placeholder="Search transcript text..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              border: 'none',
              outline: 'none',
              fontSize: '0.85rem',
              width: '100%',
              backgroundColor: 'transparent'
            }}
          />
        </div>

        {/* Speaker Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <Filter size={15} style={{ color: 'var(--color-ink-muted)' }} />
          <select
            value={selectedSpeakerFilter}
            onChange={(e) => setSelectedSpeakerFilter(e.target.value)}
            style={{
              padding: '0.35rem 0.65rem',
              border: '1.5px solid var(--color-ink)',
              borderRadius: '3px',
              fontSize: '0.82rem',
              backgroundColor: '#FFFFFF',
              fontWeight: 600
            }}
          >
            <option value="ALL">All Speakers ({segments.length})</option>
            <option value="UNASSIGNED">Unassigned Only</option>
            {speakers.map(s => (
              <option key={s.id} value={s.id}>{s.name} ({s.role || 'Participant'})</option>
            ))}
          </select>
        </div>
      </div>

      {/* Batch Speaker Assignment Bar (Visible when segments selected) */}
      {selectedSegmentIds.length > 0 && (
        <div style={{
          backgroundColor: 'var(--color-burgundy-light)',
          border: '2px solid var(--color-burgundy)',
          borderRadius: '4px',
          padding: '0.65rem 1rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.65rem',
          marginBottom: '1rem',
          boxShadow: 'var(--shadow-solid-sm)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.88rem', fontWeight: 700 }}>
            <span>{selectedSegmentIds.length} segments selected</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <select
              value={batchSpeakerId}
              onChange={(e) => setBatchSpeakerId(e.target.value)}
              style={{
                padding: '0.35rem 0.65rem',
                border: '1.5px solid var(--color-ink)',
                borderRadius: '3px',
                fontSize: '0.82rem',
                backgroundColor: '#FFFFFF'
              }}
            >
              <option value="">Select Speaker to Assign ▾</option>
              {speakers.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
              <option value="__CLEAR__">Clear Speaker (Unassigned)</option>
            </select>

            <button
              onClick={handleBatchAssign}
              disabled={!batchSpeakerId}
              className="btn-burgundy btn-sm"
            >
              Apply Batch
            </button>

            <button
              onClick={() => setSelectedSegmentIds([])}
              className="btn-secondary btn-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Segments List */}
      <div style={{ maxHeight: '550px', overflowY: 'auto', paddingRight: '0.35rem', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
        {filteredSegments.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--color-ink-muted)' }}>
            <p style={{ fontWeight: 700 }}>No segments match your search/filter criteria.</p>
          </div>
        ) : (
          filteredSegments.map((seg) => {
            const isPlayingThis = activeSegmentId === seg.id;
            const isSelected = selectedSegmentIds.includes(seg.id);
            const speakerName = seg.speaker_name || 'Unassigned';

            return (
              <div
                key={seg.id}
                id={`seg-${seg.id}`}
                className={`segment-card ${isPlayingThis ? 'active-playback' : ''}`}
                style={{
                  backgroundColor: isSelected ? 'var(--bg-secondary)' : (isPlayingThis ? '#FCECEF' : '#FFFFFF'),
                  borderColor: isPlayingThis ? 'var(--color-burgundy)' : (isSelected ? 'var(--color-ink)' : 'var(--color-border-light)')
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem', flexWrap: 'wrap', gap: '0.4rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <input
                      type="checkbox"
                      className="custom-checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelectSegment(seg.id)}
                      style={{ width: '1rem', height: '1rem' }}
                    />

                    <span style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      backgroundColor: 'var(--bg-primary)',
                      border: '1px solid var(--color-ink)',
                      padding: '0.1rem 0.35rem',
                      borderRadius: '2px'
                    }}>
                      #{seg.id}
                    </span>

                    {/* Clickable timestamp jumper */}
                    <button
                      type="button"
                      onClick={() => onSeek(seg.start)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        backgroundColor: isPlayingThis ? 'var(--color-burgundy)' : 'var(--bg-primary)',
                        color: isPlayingThis ? '#FFFFFF' : 'var(--color-ink)',
                        border: '1px solid var(--color-ink)',
                        padding: '0.15rem 0.5rem',
                        borderRadius: '3px',
                        cursor: 'pointer',
                        boxShadow: '1px 1px 0px var(--color-ink)'
                      }}
                      title="Click to seek audio to this segment"
                    >
                      <Play size={10} fill={isPlayingThis ? '#FFFFFF' : 'var(--color-ink)'} />
                      <span>{formatSeconds(seg.start)} - {formatSeconds(seg.end)}</span>
                    </button>
                  </div>

                  {/* Manual Speaker Assignment Selector */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <select
                      value={seg.speaker_id || ''}
                      onChange={(e) => handleSingleSpeakerChange(seg.id, e)}
                      style={{
                        ...getSpeakerBadgeStyle(seg.speaker_id),
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        padding: '0.15rem 0.45rem',
                        borderRadius: '3px',
                        cursor: 'pointer',
                        outline: 'none'
                      }}
                    >
                      <option value="">👤 Unassigned</option>
                      {speakers.map(s => (
                        <option key={s.id} value={s.id}>
                          👤 {s.name} {s.role ? `(${s.role})` : ''}
                        </option>
                      ))}
                      <option value="__NEW__">+ Add New Speaker...</option>
                    </select>
                  </div>
                </div>

                {/* Segment Text */}
                <p style={{
                  fontSize: '0.92rem',
                  lineHeight: 1.5,
                  color: 'var(--color-ink)',
                  paddingLeft: '1.75rem'
                }}>
                  {seg.text}
                </p>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
