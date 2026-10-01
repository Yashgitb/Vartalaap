import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, RotateCcw, RotateCw, Volume2, VolumeX, Sparkles } from 'lucide-react';
import { formatSeconds } from '../utils/formatters';

export default function AudioPlayer({ audioUrl, onTimeUpdate, seekTime, title }) {
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);

  // Handle external seek requests (e.g. from segment click or task jumper)
  useEffect(() => {
    if (seekTime !== null && seekTime !== undefined && audioRef.current) {
      audioRef.current.currentTime = seekTime;
      setCurrentTime(seekTime);
      if (!isPlaying) {
        audioRef.current.play().catch(e => console.log("Play interrupted:", e));
        setIsPlaying(true);
      }
    }
  }, [seekTime]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().catch(e => console.log("Playback error:", e));
      setIsPlaying(true);
    }
  };

  const handleTimeUpdate = () => {
    if (!audioRef.current) return;
    const curr = audioRef.current.currentTime;
    setCurrentTime(curr);
    if (onTimeUpdate) {
      onTimeUpdate(curr);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration || 0);
    }
  };

  const handleScrubberChange = (e) => {
    const newTime = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
      setCurrentTime(newTime);
      if (onTimeUpdate) onTimeUpdate(newTime);
    }
  };

  const skipSeconds = (seconds) => {
    if (!audioRef.current) return;
    const target = Math.min(Math.max(0, audioRef.current.currentTime + seconds), duration);
    audioRef.current.currentTime = target;
    setCurrentTime(target);
    if (onTimeUpdate) onTimeUpdate(target);
  };

  const changeSpeed = (rate) => {
    if (audioRef.current) {
      audioRef.current.playbackRate = rate;
      setPlaybackRate(rate);
    }
  };

  const toggleMute = () => {
    if (audioRef.current) {
      audioRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  return (
    <div className="retro-card" style={{
      padding: '1.25rem 1.5rem',
      backgroundColor: 'var(--bg-card)',
      marginBottom: '1.5rem'
    }}>
      <audio
        ref={audioRef}
        src={audioUrl}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={() => setIsPlaying(false)}
        preload="metadata"
      />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
        <div>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-burgundy)', textTransform: 'uppercase' }}>
            Synchronized Audio Player
          </span>
          <h4 className="font-serif" style={{ fontSize: '1.1rem', color: 'var(--color-ink)', marginTop: '2px' }}>
            {title || "Meeting Audio Recording"}
          </h4>
        </div>

        {/* Speed presets */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', backgroundColor: 'var(--bg-primary)', padding: '0.2rem', borderRadius: '4px', border: '1px solid var(--color-border-light)' }}>
          {[0.75, 1, 1.25, 1.5, 2].map((rate) => (
            <button
              key={rate}
              onClick={() => changeSpeed(rate)}
              style={{
                border: 'none',
                backgroundColor: playbackRate === rate ? 'var(--color-burgundy)' : 'transparent',
                color: playbackRate === rate ? '#FFFFFF' : 'var(--color-ink)',
                fontSize: '0.72rem',
                fontWeight: 700,
                padding: '0.2rem 0.45rem',
                borderRadius: '3px',
                cursor: 'pointer',
                transition: 'all 0.1s'
              }}
            >
              {rate}x
            </button>
          ))}
        </div>
      </div>

      {/* Scrubber Bar */}
      <div style={{ marginBottom: '0.75rem' }}>
        <input
          type="range"
          min="0"
          max={duration || 100}
          step="0.1"
          value={currentTime}
          onChange={handleScrubberChange}
          className="audio-scrubber"
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--color-ink-muted)', marginTop: '0.25rem' }}>
          <span>{formatSeconds(currentTime)}</span>
          <span>{formatSeconds(duration)}</span>
        </div>
      </div>

      {/* Playback Controls */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <button
            onClick={() => skipSeconds(-5)}
            className="btn-secondary btn-sm"
            title="Rewind 5 seconds"
          >
            <RotateCcw size={15} />
            <span style={{ fontSize: '0.75rem' }}>-5s</span>
          </button>

          <button
            onClick={togglePlay}
            className="btn-burgundy"
            style={{ width: '42px', height: '42px', padding: 0, borderRadius: '50%' }}
            title={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? <Pause size={20} /> : <Play size={20} style={{ marginLeft: '2px' }} />}
          </button>

          <button
            onClick={() => skipSeconds(5)}
            className="btn-secondary btn-sm"
            title="Forward 5 seconds"
          >
            <RotateCw size={15} />
            <span style={{ fontSize: '0.75rem' }}>+5s</span>
          </button>
        </div>

        {/* Volume & Sync Indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', color: 'var(--color-ink-muted)' }}>
            <Sparkles size={14} style={{ color: 'var(--color-burgundy)' }} />
            <span>Click any transcript segment or task reference to seek audio</span>
          </div>

          <button
            onClick={toggleMute}
            className="btn-secondary btn-sm"
            style={{ padding: '0.35rem 0.5rem' }}
          >
            {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>
        </div>
      </div>
    </div>
  );
}
