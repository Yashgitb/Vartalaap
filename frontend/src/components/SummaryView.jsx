import React, { useState } from 'react';
import { Sparkles, Target, CheckSquare, Users, FileText, RefreshCw, Play, Clock, User, AlertCircle, ArrowRight, CheckCircle2 } from 'lucide-react';
import { formatSeconds } from '../utils/formatters';

export default function SummaryView({
  recordingId,
  summary,
  summaryStatus,
  summaryError,
  segments = [],
  onSeekSegment,
  onRegenerateSummary
}) {
  const [activeTab, setActiveTab] = useState('overview'); // overview, people, goals, tasks, decisions
  const [customPrompt, setCustomPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [completedTasks, setCompletedTasks] = useState({});

  const toggleTask = (taskId) => {
    setCompletedTasks(prev => ({
      ...prev,
      [taskId]: !prev[taskId]
    }));
  };

  const handleGenerate = async () => {
    setLoading(true);
    try {
      if (onRegenerateSummary) {
        await onRegenerateSummary(customPrompt);
      }
    } finally {
      setLoading(false);
    }
  };

  const getSegmentTime = (segId) => {
    const s = segments.find(x => x.id === segId);
    return s ? s.start : 0;
  };

  // Render supporting segment chips
  const renderSegmentChips = (segIds = []) => {
    if (!segIds || segIds.length === 0) return null;
    return (
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap', marginTop: '0.35rem' }}>
        <span style={{ fontSize: '0.72rem', color: 'var(--color-ink-muted)', fontWeight: 600 }}>Sources:</span>
        {segIds.map(id => (
          <button
            key={id}
            type="button"
            onClick={() => onSeekSegment(getSegmentTime(id))}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.2rem',
              backgroundColor: 'var(--bg-primary)',
              color: 'var(--color-burgundy)',
              border: '1px solid var(--color-burgundy)',
              borderRadius: '2px',
              padding: '0.1rem 0.35rem',
              fontSize: '0.72rem',
              fontFamily: 'var(--font-mono)',
              fontWeight: 700,
              cursor: 'pointer'
            }}
            title={`Jump audio to transcript segment #${id}`}
          >
            <Play size={8} />
            <span>#{id}</span>
          </button>
        ))}
      </div>
    );
  };

  // If no summary or summary failed
  if (!summary || summaryStatus === 'failed') {
    return (
      <div className="retro-card" style={{ padding: '1.5rem', backgroundColor: 'var(--bg-card)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
          <Sparkles size={20} style={{ color: 'var(--color-burgundy)' }} />
          <h3 className="font-serif" style={{ fontSize: '1.3rem', color: 'var(--color-ink)' }}>
            Groq Llama 3.3 Structured Summarisation
          </h3>
        </div>

        {summaryStatus === 'failed' ? (
          <div style={{
            backgroundColor: 'var(--color-burgundy-light)',
            border: '2px solid var(--color-burgundy)',
            padding: '1rem',
            borderRadius: '4px',
            marginBottom: '1.25rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-burgundy)', fontWeight: 700, marginBottom: '0.25rem' }}>
              <AlertCircle size={18} />
              <span>Summarisation Error (Transcript Preserved)</span>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--color-ink)' }}>
              {summaryError || "The summary could not be generated. Your audio transcript is safe in the database."}
            </p>
          </div>
        ) : (
          <p style={{ fontSize: '0.9rem', color: 'var(--color-ink-muted)', marginBottom: '1.25rem' }}>
            Generate executive summaries, person-wise contributions, goals, decisions, and actionable tasks with transcript segment links.
          </p>
        )}

        {/* Custom Instructions Input */}
        <div style={{ marginBottom: '1.25rem' }}>
          <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem' }}>
            Custom Focus or Instructions (Optional):
          </label>
          <input
            type="text"
            placeholder="e.g. Focus on product timeline, financial approvals, and technical decisions"
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            style={{
              width: '100%',
              padding: '0.65rem 0.85rem',
              border: '1.5px solid var(--color-ink)',
              borderRadius: '4px',
              fontSize: '0.88rem',
              backgroundColor: 'var(--bg-primary)'
            }}
          />
        </div>

        <button
          onClick={handleGenerate}
          disabled={loading || segments.length === 0}
          className="btn-burgundy"
          style={{ width: '100%', padding: '0.75rem 1.5rem' }}
        >
          {loading ? (
            <>
              <RefreshCw size={16} className="animate-spin" />
              <span>Generating Structured Summary with Groq...</span>
            </>
          ) : (
            <>
              <Sparkles size={16} />
              <span>{summaryStatus === 'failed' ? 'Retry Summarisation (Groq Llama 3.3)' : 'Generate Meeting Intelligence'}</span>
            </>
          )}
        </button>
      </div>
    );
  }

  const tasks = summary.tasks || [];
  const goals = summary.goals || [];
  const decisions = summary.decisions || [];
  const personSummaries = summary.person_summaries || [];
  const keyPoints = summary.key_discussion_points || [];

  return (
    <div className="retro-card" style={{ padding: '1.25rem', backgroundColor: 'var(--bg-card)' }}>
      {/* Title & Metadata Header */}
      <div style={{ borderBottom: '1.5px solid var(--color-border-light)', paddingBottom: '0.85rem', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.35rem' }}>
          <span className="chip-status-ok" style={{ fontSize: '0.72rem' }}>
            Structured Groq Intelligence
          </span>
          <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--color-ink-muted)' }}>
            Model: {summary.model_used || 'llama-3.3-70b-versatile'}
          </span>
        </div>
        <h2 className="font-serif" style={{ fontSize: '1.45rem', color: 'var(--color-ink)' }}>
          {summary.title || "Meeting Summary"}
        </h2>
      </div>

      {/* Tabs Navigation matching Reference Design */}
      <div style={{
        display: 'flex',
        gap: '0.35rem',
        borderBottom: '2px solid var(--color-ink)',
        marginBottom: '1.25rem',
        overflowX: 'auto',
        paddingBottom: '0px'
      }}>
        {[
          { id: 'overview', label: 'Executive Summary', count: null },
          { id: 'tasks', label: 'Action Items', count: tasks.length },
          { id: 'people', label: 'Person Perspectives', count: personSummaries.length },
          { id: 'goals', label: 'Goals & Milestones', count: goals.length },
          { id: 'decisions', label: 'Decisions', count: decisions.length },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '0.5rem 0.85rem',
              borderTop: '2px solid var(--color-ink)',
              borderLeft: '2px solid var(--color-ink)',
              borderRight: '2px solid var(--color-ink)',
              borderBottom: activeTab === tab.id ? 'none' : '2px solid var(--color-ink)',
              backgroundColor: activeTab === tab.id ? 'var(--bg-card)' : 'var(--bg-secondary)',
              color: activeTab === tab.id ? 'var(--color-burgundy)' : 'var(--color-ink)',
              fontWeight: activeTab === tab.id ? 800 : 600,
              fontSize: '0.82rem',
              borderRadius: '4px 4px 0 0',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              marginBottom: activeTab === tab.id ? '-2px' : '0px',
              zIndex: activeTab === tab.id ? 2 : 1
            }}
          >
            <span>{tab.label}</span>
            {tab.count !== null && (
              <span style={{
                backgroundColor: activeTab === tab.id ? 'var(--color-burgundy)' : 'var(--color-ink-muted)',
                color: '#FFFFFF',
                fontSize: '0.7rem',
                padding: '0.05rem 0.35rem',
                borderRadius: '10px'
              }}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab 1: Executive Overview */}
      {activeTab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Executive Summary Box */}
          <div style={{
            backgroundColor: 'var(--bg-primary)',
            border: '2px solid var(--color-ink)',
            borderRadius: '4px',
            padding: '1.25rem',
            boxShadow: 'var(--shadow-solid-sm)'
          }}>
            <h4 className="font-serif" style={{ fontSize: '1.05rem', color: 'var(--color-burgundy)', marginBottom: '0.5rem' }}>
              Executive Summary
            </h4>
            <p style={{ fontSize: '0.92rem', lineHeight: 1.6, color: 'var(--color-ink)' }}>
              {summary.overall_summary}
            </p>
          </div>

          {/* Key Discussion Points */}
          {keyPoints.length > 0 && (
            <div>
              <h4 className="font-serif" style={{ fontSize: '1.05rem', color: 'var(--color-ink)', marginBottom: '0.65rem' }}>
                Key Discussion Topics
              </h4>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {keyPoints.map((pt, idx) => (
                  <li
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '0.6rem',
                      backgroundColor: '#FFFFFF',
                      border: '1.5px solid var(--color-border-light)',
                      borderRadius: '4px',
                      padding: '0.65rem 0.85rem',
                      fontSize: '0.88rem'
                    }}
                  >
                    <span style={{
                      backgroundColor: 'var(--color-burgundy-light)',
                      color: 'var(--color-burgundy)',
                      border: '1px solid var(--color-burgundy)',
                      width: '20px',
                      height: '20px',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      flexShrink: 0,
                      marginTop: '2px'
                    }}>
                      {idx + 1}
                    </span>
                    <span style={{ color: 'var(--color-ink)', lineHeight: 1.4 }}>{pt}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Action Items & Tasks */}
      {activeTab === 'tasks' && (
        <div>
          {tasks.length === 0 ? (
            <p style={{ color: 'var(--color-ink-muted)', textAlign: 'center', padding: '1.5rem' }}>No explicit action items detected in this transcript.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {tasks.map((task, idx) => {
                const isDone = completedTasks[task.id] || task.completed;
                const priorityColor =
                  task.priority === 'high' ? 'var(--color-burgundy)' :
                  task.priority === 'low' ? 'var(--color-green)' : 'var(--color-amber)';
                
                return (
                  <div
                    key={task.id || idx}
                    style={{
                      backgroundColor: isDone ? 'var(--bg-primary)' : '#FFFFFF',
                      border: `2px solid ${isDone ? 'var(--color-border-light)' : 'var(--color-ink)'}`,
                      borderRadius: '4px',
                      padding: '0.85rem 1rem',
                      boxShadow: isDone ? 'none' : 'var(--shadow-solid-sm)',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                      <input
                        type="checkbox"
                        className="custom-checkbox"
                        checked={isDone}
                        onChange={() => toggleTask(task.id)}
                        style={{ marginTop: '2px', flexShrink: 0 }}
                      />

                      <div style={{ flex: 1 }}>
                        <div style={{
                          fontSize: '0.95rem',
                          fontWeight: 700,
                          color: isDone ? 'var(--color-ink-muted)' : 'var(--color-ink)',
                          textDecoration: isDone ? 'line-through' : 'none',
                          marginBottom: '0.4rem'
                        }}>
                          {task.action}
                        </div>

                        {/* Badges: Owner, Deadline, Priority */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', fontSize: '0.78rem' }}>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                            backgroundColor: 'var(--bg-secondary)',
                            border: '1px solid var(--color-ink)',
                            padding: '0.1rem 0.45rem',
                            borderRadius: '3px',
                            fontWeight: 600
                          }}>
                            <User size={12} />
                            <span>Owner: <strong>{task.owner || 'Unassigned'}</strong></span>
                          </span>

                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                            backgroundColor: 'var(--bg-secondary)',
                            border: '1px solid var(--color-ink)',
                            padding: '0.1rem 0.45rem',
                            borderRadius: '3px',
                            fontWeight: 600
                          }}>
                            <Clock size={12} />
                            <span>Due: <strong>{task.deadline || 'Not specified'}</strong></span>
                          </span>

                          <span style={{
                            backgroundColor: `${priorityColor}18`,
                            color: priorityColor,
                            border: `1.5px solid ${priorityColor}`,
                            padding: '0.1rem 0.45rem',
                            borderRadius: '3px',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            fontSize: '0.7rem'
                          }}>
                            {task.priority || 'medium'}
                          </span>
                        </div>

                        {/* Supporting Segment links */}
                        {renderSegmentChips(task.supporting_segment_ids)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Person Perspectives */}
      {activeTab === 'people' && (
        <div>
          {personSummaries.length === 0 ? (
            <p style={{ color: 'var(--color-ink-muted)', textAlign: 'center', padding: '1.5rem' }}>No individual participant perspectives found.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {personSummaries.map((person, idx) => (
                <div
                  key={idx}
                  style={{
                    backgroundColor: '#FFFFFF',
                    border: '2px solid var(--color-ink)',
                    borderRadius: '4px',
                    padding: '1rem',
                    boxShadow: 'var(--shadow-solid-sm)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <div style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '4px',
                        backgroundColor: 'var(--color-burgundy)',
                        color: '#FFFFFF',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        fontSize: '0.85rem',
                        border: '1px solid var(--color-ink)'
                      }}>
                        {person.speaker_name.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-serif" style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-ink)' }}>
                        {person.speaker_name}
                      </span>
                      {person.role && (
                        <span style={{ fontSize: '0.75rem', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--color-ink)', padding: '0.1rem 0.4rem', borderRadius: '3px' }}>
                          {person.role}
                        </span>
                      )}
                    </div>
                  </div>

                  <p style={{ fontSize: '0.88rem', color: 'var(--color-ink)', lineHeight: 1.5, marginBottom: '0.5rem' }}>
                    {person.summary}
                  </p>

                  {person.key_contributions && person.key_contributions.length > 0 && (
                    <div style={{ marginTop: '0.5rem' }}>
                      <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-ink-muted)' }}>Key Contributions:</span>
                      <ul style={{ listStyleType: 'disc', paddingLeft: '1.25rem', fontSize: '0.84rem', color: 'var(--color-ink)', marginTop: '0.2rem' }}>
                        {person.key_contributions.map((c, cIdx) => (
                          <li key={cIdx}>{c}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {renderSegmentChips(person.supporting_segment_ids)}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 4: Goals & Milestones */}
      {activeTab === 'goals' && (
        <div>
          {goals.length === 0 ? (
            <p style={{ color: 'var(--color-ink-muted)', textAlign: 'center', padding: '1.5rem' }}>No specific goals or targets extracted.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {goals.map((goal, idx) => (
                <div
                  key={idx}
                  style={{
                    backgroundColor: '#FFFFFF',
                    border: '2px solid var(--color-ink)',
                    borderRadius: '4px',
                    padding: '0.85rem 1rem',
                    boxShadow: 'var(--shadow-solid-sm)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                    <span className="font-serif" style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-ink)' }}>
                      {goal.goal}
                    </span>
                    <span className={goal.status === 'achieved' ? 'chip-status-ok' : (goal.status === 'in_progress' ? 'chip-status-amber' : 'chip-status-burgundy')}>
                      {goal.status.replace('_', ' ')}
                    </span>
                  </div>
                  {renderSegmentChips(goal.supporting_segment_ids)}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 5: Decisions */}
      {activeTab === 'decisions' && (
        <div>
          {decisions.length === 0 ? (
            <p style={{ color: 'var(--color-ink-muted)', textAlign: 'center', padding: '1.5rem' }}>No final decisions flagged in this discussion.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {decisions.map((dec, idx) => (
                <div
                  key={idx}
                  style={{
                    backgroundColor: '#FFFFFF',
                    border: '2px solid var(--color-ink)',
                    borderRadius: '4px',
                    padding: '0.85rem 1rem',
                    boxShadow: 'var(--shadow-solid-sm)'
                  }}
                >
                  <h4 className="font-serif" style={{ fontSize: '1.05rem', color: 'var(--color-burgundy)', marginBottom: '0.35rem' }}>
                    {dec.decision}
                  </h4>
                  {dec.rationale && (
                    <p style={{ fontSize: '0.85rem', color: 'var(--color-ink-muted)', lineHeight: 1.4 }}>
                      <strong>Rationale:</strong> {dec.rationale}
                    </p>
                  )}
                  {renderSegmentChips(dec.supporting_segment_ids)}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Regenerate or Custom Instructions Bar */}
      <div style={{
        marginTop: '1.5rem',
        paddingTop: '1rem',
        borderTop: '1.5px solid var(--color-border-light)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '0.75rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: '220px' }}>
          <input
            type="text"
            placeholder="Custom instructions for summary refresh..."
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            style={{
              padding: '0.45rem 0.75rem',
              border: '1.5px solid var(--color-ink)',
              borderRadius: '3px',
              fontSize: '0.82rem',
              backgroundColor: 'var(--bg-primary)',
              width: '100%'
            }}
          />
        </div>

        <button
          onClick={handleGenerate}
          disabled={loading}
          className="btn-secondary btn-sm"
          style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          <span>{loading ? 'Re-summarising...' : 'Re-summarise'}</span>
        </button>
      </div>
    </div>
  );
}
