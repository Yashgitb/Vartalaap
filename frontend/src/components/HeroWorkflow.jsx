import React from 'react';
import { UploadCloud, Zap, Users, BrainCircuit, CheckCircle2, ArrowRight } from 'lucide-react';

export default function HeroWorkflow({ onStartNew }) {
  const steps = [
    {
      num: '01',
      title: 'Audio Ingestion',
      desc: 'Record live or upload audio validated against Groq 25MB limit and formats.',
      icon: <UploadCloud size={16} />
    },
    {
      num: '02',
      title: 'Whisper v3 Turbo',
      desc: 'Fast speech-to-text with verbose_json segment timestamps and IDs.',
      icon: <Zap size={16} />
    },
    {
      num: '03',
      title: 'Speaker Tagging',
      desc: 'Manual speaker attribution without hallucinating unverified identities.',
      icon: <Users size={16} />
    },
    {
      num: '04',
      title: 'Llama 3.3 Summarisation',
      desc: 'Structured Pydantic summary extracting goals, decisions and perspectives.',
      icon: <BrainCircuit size={16} />
    },
    {
      num: '05',
      title: 'Actionable Insights',
      desc: 'Owners, deadlines, and direct segment jumpers linking audio to tasks.',
      icon: <CheckCircle2 size={16} />
    }
  ];

  return (
    <div style={{ marginBottom: '2.5rem' }}>
      {/* Hero Headline Section */}
      <div style={{
        textAlign: 'center',
        padding: '2.5rem 1rem 1.8rem 1rem',
        maxWidth: '900px',
        margin: '0 auto'
      }}>
        <div style={{
          display: 'inline-block',
          border: '1.5px solid var(--color-ink)',
          padding: '0.2rem 0.75rem',
          fontSize: '0.8rem',
          fontWeight: 700,
          backgroundColor: 'var(--bg-card)',
          borderRadius: '3px',
          marginBottom: '1rem',
          boxShadow: '2px 2px 0px var(--color-ink)'
        }}>
          Built for High-Speed Meeting & Conversation Intelligence
        </div>

        <h1 className="font-serif" style={{
          fontSize: '2.75rem',
          lineHeight: 1.15,
          color: 'var(--color-ink)',
          marginBottom: '0.85rem'
        }}>
          One system for <span style={{ color: 'var(--color-burgundy)', fontStyle: 'italic' }}>every conversation</span>, every insight.
        </h1>

        <p style={{
          fontSize: '1.05rem',
          color: 'var(--color-ink-muted)',
          maxWidth: '720px',
          margin: '0 auto 1.75rem auto'
        }}>
          Vartalaap pairs Groq's high-throughput <strong style={{ color: 'var(--color-ink)' }}>Whisper Large v3 Turbo</strong> speech recognition with <strong style={{ color: 'var(--color-ink)' }}>Llama 3.3 70B</strong> structured intelligence for instant meeting transcripts, manual speaker attribution, and actionable summaries.
        </p>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <button
            onClick={onStartNew}
            className="btn-burgundy"
            style={{ fontSize: '1rem', padding: '0.75rem 1.75rem' }}
          >
            <span>Start New Transcription</span>
            <ArrowRight size={18} />
          </button>
        </div>
      </div>

      {/* 5-Step Workflow Cards matching Reference Screenshot 2 */}
      <div style={{ maxWidth: '1350px', margin: '0 auto', padding: '0 1rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
          <h2 className="font-serif" style={{ fontSize: '1.5rem', color: 'var(--color-ink)' }}>
            Five-step Groq AI pipeline
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--color-ink-muted)' }}>
            Separating speech-to-text inference, manual speaker attribution, and structured summarisation
          </p>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
          gap: '1rem',
          marginTop: '1rem'
        }}>
          {steps.map((step, idx) => (
            <div
              key={idx}
              className="step-card"
              style={{
                transition: 'transform 0.15s ease, box-shadow 0.15s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                <span className="step-num-badge">
                  {step.num}
                </span>
                <span style={{ color: 'var(--color-ink-muted)' }}>
                  {step.icon}
                </span>
              </div>
              <h3 className="font-serif" style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '0.4rem', color: 'var(--color-ink)' }}>
                {step.title}
              </h3>
              <p style={{ fontSize: '0.82rem', color: 'var(--color-ink-muted)', lineHeight: 1.4 }}>
                {step.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
