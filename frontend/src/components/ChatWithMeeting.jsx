import React, { useState, useEffect, useRef } from 'react';
import { 
  MessageSquare, Send, Sparkles, Clock, User, 
  RotateCcw, AlertCircle, CheckCircle2, ChevronDown, 
  ChevronUp, Play, BookOpen, Layers
} from 'lucide-react';
import { api } from '../api/client';
import { formatSeconds } from '../utils/formatters';

const SUGGESTED_QUESTIONS = [
  "What were the main topics discussed?",
  "What decisions were made?",
  "What deadlines were mentioned?",
  "Who was assigned which task?",
  "What was agreed regarding budget and approvals?"
];

// Clean formatting component: renders bullets, bold headings, and interactive timestamp chips
function FormattedMessageText({ text, isUser, onSeekSegment }) {
  if (isUser) {
    return <div style={{ fontSize: '0.88rem', whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>{text}</div>;
  }

  // Parse inline elements (bold **text** and timestamp badges [MM:SS])
  const parseInline = (lineText) => {
    // Matches patterns like `[06:34 - 06:45]` or [06:34 - 06:45] or `[06:34]` or [06:34]
    const timestampRegex = /(`?\[?(\d{1,2}:\d{2})(?:\s*-\s*(\d{1,2}:\d{2}))?\]?`?)/g;
    const boldParts = lineText.split(/(\*\*[^*]+\*\*)/g);

    return boldParts.map((part, pIdx) => {
      const isBold = part.startsWith('**') && part.endsWith('**');
      const cleanPart = isBold ? part.slice(2, -2) : part;

      const tokens = [];
      let lastIndex = 0;
      let match;
      timestampRegex.lastIndex = 0;

      while ((match = timestampRegex.exec(cleanPart)) !== null) {
        if (match.index > lastIndex) {
          tokens.push(cleanPart.substring(lastIndex, match.index));
        }

        const fullMatch = match[0];
        const startTimeStr = match[2];
        const [m, s] = startTimeStr.split(':').map(Number);
        const startSec = (m || 0) * 60 + (s || 0);

        tokens.push(
          <button
            key={`ts_${pIdx}_${match.index}`}
            type="button"
            onClick={() => onSeekSegment && onSeekSegment(startSec)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '2px',
              padding: '1px 5px',
              fontSize: '0.72rem',
              backgroundColor: 'rgba(139, 38, 53, 0.1)',
              color: 'var(--color-burgundy)',
              border: '1px solid var(--color-burgundy)',
              borderRadius: '3px',
              cursor: 'pointer',
              fontWeight: 700,
              verticalAlign: 'baseline',
              margin: '0 2px',
              lineHeight: '1.2'
            }}
            title={`Jump audio to ${startTimeStr}`}
          >
            <Play size={8} />
            <span>{fullMatch.replace(/[`\[\]]/g, '').trim()}</span>
          </button>
        );

        lastIndex = match.index + fullMatch.length;
      }

      if (lastIndex < cleanPart.length) {
        tokens.push(cleanPart.substring(lastIndex));
      }

      if (isBold) {
        return <strong key={pIdx} style={{ color: 'var(--color-ink)', fontWeight: 700 }}>{tokens}</strong>;
      }
      return <React.Fragment key={pIdx}>{tokens}</React.Fragment>;
    });
  };

  // Group lines into paragraphs and list items
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const items = [];
  let currentList = null;

  lines.forEach((line) => {
    const bulletMatch = line.match(/^([*\-•]|\d+\.)\s+(.+)$/);
    if (bulletMatch) {
      if (!currentList) {
        currentList = { type: 'list', items: [] };
        items.push(currentList);
      }
      currentList.items.push(bulletMatch[2]);
    } else {
      currentList = null;
      items.push({ type: 'paragraph', text: line });
    }
  });

  return (
    <div style={{
      fontSize: '0.88rem',
      lineHeight: '1.55',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.45rem'
    }}>
      {items.map((item, idx) => {
        if (item.type === 'list') {
          return (
            <ul
              key={idx}
              style={{
                margin: '0.2rem 0',
                paddingLeft: '1.15rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.35rem',
                listStyleType: 'disc'
              }}
            >
              {item.items.map((liText, lIdx) => (
                <li key={lIdx} style={{ color: 'var(--color-ink)', lineHeight: '1.45' }}>
                  {parseInline(liText)}
                </li>
              ))}
            </ul>
          );
        }

        return (
          <p key={idx} style={{ margin: 0, color: 'var(--color-ink)' }}>
            {parseInline(item.text)}
          </p>
        );
      })}
    </div>
  );
}

export default function ChatWithMeeting({
  recordingId,
  recordingTitle,
  onSeekSegment,
  onError
}) {
  const [messages, setMessages] = useState([]);
  const [inputQuestion, setInputQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [indexStatus, setIndexStatus] = useState(null);
  const [indexing, setIndexing] = useState(false);
  const [expandedSources, setExpandedSources] = useState({});
  const messagesEndRef = useRef(null);

  // Auto-scroll to bottom of chat
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  // Load chat index status on mount or recording change
  useEffect(() => {
    if (!recordingId) return;

    let isMounted = true;
    const fetchStatus = async () => {
      try {
        const status = await api.getChatStatus(recordingId);
        if (isMounted) setIndexStatus(status);
      } catch (err) {
        console.warn("Could not fetch chat index status:", err);
      }
    };

    fetchStatus();
    // Reset conversation history for newly selected recording
    setMessages([
      {
        id: 'welcome',
        role: 'assistant',
        text: `Hello! I am your AI Meeting Assistant for "${recordingTitle || 'this meeting'}". Ask me any question, and I will answer strictly based on the verified meeting transcript.`,
        sources: [],
        is_fallback: false,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ]);

    return () => {
      isMounted = false;
    };
  }, [recordingId, recordingTitle]);

  // Handle re-indexing
  const handleReindex = async () => {
    setIndexing(true);
    try {
      const res = await api.indexTranscript(recordingId);
      setIndexStatus(res);
    } catch (err) {
      if (onError) onError(err.message || "Failed to index transcript");
    } finally {
      setIndexing(false);
    }
  };

  // Submit question to RAG
  const handleSendQuestion = async (queryText) => {
    const q = (queryText || inputQuestion).trim();
    if (!q || loading) return;

    const userMessageId = `user_${Date.now()}`;
    const userMsg = {
      id: userMessageId,
      role: 'user',
      text: q,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    setInputQuestion('');
    setLoading(true);

    try {
      const res = await api.chatWithMeeting(recordingId, q);
      const assistantMsg = {
        id: `ai_${Date.now()}`,
        role: 'assistant',
        text: res.answer,
        sources: res.sources || [],
        model_used: res.model_used,
        is_fallback: res.is_fallback,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch (err) {
      const errMsg = {
        id: `err_${Date.now()}`,
        role: 'assistant',
        text: `Error retrieving answer: ${err.message || 'Unknown network error'}. Please verify backend status and API configuration.`,
        sources: [],
        is_fallback: true,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, errMsg]);
      if (onError) onError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendQuestion();
    }
  };

  const toggleSources = (msgId) => {
    setExpandedSources(prev => ({
      ...prev,
      [msgId]: !prev[msgId]
    }));
  };

  const clearChat = () => {
    setMessages([
      {
        id: 'welcome_reset',
        role: 'assistant',
        text: `Chat reset. Ask me anything about "${recordingTitle || 'this meeting'}"!`,
        sources: [],
        is_fallback: false,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ]);
  };

  return (
    <div style={{
      backgroundColor: 'var(--bg-card)',
      border: '2px solid var(--color-ink)',
      borderRadius: '4px',
      boxShadow: 'var(--shadow-solid)',
      display: 'flex',
      flexDirection: 'column',
      height: '680px',
      overflow: 'hidden'
    }}>
      {/* Top Header */}
      <div style={{
        padding: '0.85rem 1.15rem',
        borderBottom: '2px solid var(--color-ink)',
        backgroundColor: 'var(--bg-card)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '0.5rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <div style={{
            width: '28px',
            height: '28px',
            backgroundColor: 'var(--color-burgundy)',
            color: '#FAF7F2',
            borderRadius: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <MessageSquare size={16} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <h3 className="font-serif" style={{ fontSize: '1.05rem', margin: 0, color: 'var(--color-ink)' }}>
                Chat with Meeting
              </h3>
              <span style={{
                fontSize: '0.68rem',
                padding: '2px 6px',
                borderRadius: '3px',
                backgroundColor: 'rgba(139, 38, 53, 0.12)',
                color: 'var(--color-burgundy)',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.04em'
              }}>
                RAG Engine
              </span>
            </div>
            <p style={{ fontSize: '0.74rem', color: 'var(--color-ink-muted)', margin: 0 }}>
              Grounded strictly in the verified transcript • No hallucination
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {indexStatus && (
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.3rem',
              fontSize: '0.74rem',
              padding: '2px 8px',
              backgroundColor: indexStatus.is_indexed ? 'rgba(30, 107, 69, 0.12)' : 'rgba(217, 119, 6, 0.12)',
              color: indexStatus.is_indexed ? 'var(--color-green, #1E6B45)' : 'var(--color-amber, #B45309)',
              border: `1px solid ${indexStatus.is_indexed ? 'var(--color-green, #1E6B45)' : 'var(--color-amber, #B45309)'}`,
              borderRadius: '3px',
              fontWeight: 600
            }}>
              <Layers size={12} />
              <span>{indexStatus.chunk_count} Chunks Indexed</span>
            </span>
          )}

          <button
            onClick={handleReindex}
            disabled={indexing}
            title="Re-chunk and update embeddings for transcript"
            className="btn-secondary btn-sm"
            style={{ padding: '0.35rem 0.6rem', fontSize: '0.75rem' }}
          >
            <RotateCcw size={12} className={indexing ? 'spin' : ''} />
            <span>{indexing ? 'Indexing...' : 'Re-index'}</span>
          </button>

          <button
            onClick={clearChat}
            title="Clear chat history"
            className="btn-secondary btn-sm"
            style={{ padding: '0.35rem 0.6rem', fontSize: '0.75rem' }}
          >
            <span>Clear</span>
          </button>
        </div>
      </div>

      {/* Suggested Questions Pills */}
      <div style={{
        padding: '0.5rem 1rem',
        backgroundColor: 'var(--bg-primary)',
        borderBottom: '1px solid var(--color-ink)',
        display: 'flex',
        alignItems: 'center',
        gap: '0.4rem',
        overflowX: 'auto',
        whiteSpace: 'nowrap'
      }}>
        <span style={{ fontSize: '0.72rem', color: 'var(--color-ink-muted)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          <Sparkles size={12} color="var(--color-burgundy)" />
          Quick:
        </span>
        {SUGGESTED_QUESTIONS.map((q, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => handleSendQuestion(q)}
            disabled={loading}
            style={{
              fontSize: '0.72rem',
              padding: '0.2rem 0.6rem',
              backgroundColor: 'var(--bg-card)',
              color: 'var(--color-ink)',
              border: '1px solid var(--color-ink)',
              borderRadius: '12px',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s ease',
              whiteSpace: 'nowrap'
            }}
            onMouseOver={(e) => { e.currentTarget.style.backgroundColor = 'var(--color-burgundy)'; e.currentTarget.style.color = '#FAF7F2'; }}
            onMouseOut={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg-card)'; e.currentTarget.style.color = 'var(--color-ink)'; }}
          >
            {q}
          </button>
        ))}
      </div>

      {/* Chat Messages Feed */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '1rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        backgroundColor: '#FCFAF7'
      }}>
        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          const hasSources = msg.sources && msg.sources.length > 0;
          const isExpanded = !!expandedSources[msg.id];

          return (
            <div
              key={msg.id}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: isUser ? 'flex-end' : 'flex-start',
                maxWidth: '100%'
              }}
            >
              <div style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.5rem',
                flexDirection: isUser ? 'row-reverse' : 'row',
                maxWidth: isUser ? '85%' : '92%'
              }}>
                {/* Avatar */}
                <div style={{
                  width: '26px',
                  height: '26px',
                  borderRadius: '3px',
                  backgroundColor: isUser ? 'var(--color-burgundy)' : 'var(--color-ink)',
                  color: '#FAF7F2',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  fontSize: '0.72rem',
                  fontWeight: 700
                }}>
                  {isUser ? <User size={14} /> : <Sparkles size={14} />}
                </div>

                {/* Message Bubble */}
                <div style={{
                  backgroundColor: isUser ? 'var(--color-burgundy)' : 'var(--bg-card)',
                  color: isUser ? '#FAF7F2' : 'var(--color-ink)',
                  border: isUser ? '1px solid var(--color-burgundy)' : '1px solid var(--color-ink)',
                  borderRadius: '4px',
                  padding: '0.75rem 0.95rem',
                  boxShadow: isUser ? 'none' : 'var(--shadow-solid-sm, 2px 2px 0px rgba(26,24,23,0.15))',
                  lineHeight: '1.5'
                }}>
                  {/* Fallback Warning Box */}
                  {msg.is_fallback && !isUser && (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.45rem',
                      marginBottom: '0.5rem',
                      padding: '0.35rem 0.55rem',
                      backgroundColor: 'rgba(217, 119, 6, 0.1)',
                      border: '1px solid #D97706',
                      borderRadius: '3px',
                      color: '#B45309',
                      fontSize: '0.76rem',
                      fontWeight: 600
                    }}>
                      <AlertCircle size={14} flexShrink={0} />
                      <span>Strict Grounding: Information not in transcript</span>
                    </div>
                  )}

                  {/* Message Text with Simple & Clean Formatting */}
                  <div style={{
                    color: isUser ? '#FAF7F2' : (msg.is_fallback ? 'var(--color-ink-muted)' : 'var(--color-ink)')
                  }}>
                    <FormattedMessageText
                      text={msg.text}
                      isUser={isUser}
                      onSeekSegment={onSeekSegment}
                    />
                  </div>

                  {/* Timestamp */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-start',
                    gap: '0.5rem',
                    marginTop: '0.45rem',
                    fontSize: '0.68rem',
                    color: isUser ? 'rgba(250, 247, 242, 0.75)' : 'var(--color-ink-muted)'
                  }}>
                    <span>{msg.timestamp}</span>
                  </div>

                  {/* Citations Accordion */}
                  {hasSources && (
                    <div style={{
                      marginTop: '0.65rem',
                      borderTop: '1px dashed rgba(26, 24, 23, 0.2)',
                      paddingTop: '0.5rem'
                    }}>
                      <button
                        type="button"
                        onClick={() => toggleSources(msg.id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--color-burgundy)',
                          fontSize: '0.74rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                          padding: '0'
                        }}
                      >
                        <BookOpen size={12} />
                        <span>{msg.sources.length} Retrieved Transcript Citations</span>
                        {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                      </button>

                      {isExpanded && (
                        <div style={{
                          marginTop: '0.5rem',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.4rem'
                        }}>
                          {msg.sources.map((src, sIdx) => (
                            <div
                              key={sIdx}
                              style={{
                                backgroundColor: 'var(--bg-primary)',
                                border: '1px solid rgba(26, 24, 23, 0.25)',
                                borderRadius: '3px',
                                padding: '0.45rem 0.6rem',
                                fontSize: '0.75rem'
                              }}
                            >
                              <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                marginBottom: '0.25rem'
                              }}>
                                <button
                                  type="button"
                                  onClick={() => onSeekSegment && onSeekSegment(src.start_time)}
                                  className="btn-burgundy btn-sm"
                                  style={{
                                    padding: '1px 6px',
                                    fontSize: '0.68rem',
                                    borderRadius: '2px',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.2rem'
                                  }}
                                  title="Jump audio player to this moment"
                                >
                                  <Play size={10} />
                                  <span>{formatSeconds(src.start_time)} - {formatSeconds(src.end_time)}</span>
                                </button>

                                <span style={{ fontSize: '0.68rem', color: 'var(--color-ink-muted)' }}>
                                  Match: {Math.round(src.similarity * 100)}%
                                </span>
                              </div>

                              <p style={{
                                margin: 0,
                                color: 'var(--color-ink)',
                                fontSize: '0.76rem',
                                lineHeight: '1.35',
                                fontStyle: 'italic'
                              }}>
                                "{src.text}"
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* Loading Spinner Indicator */}
        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', alignSelf: 'flex-start' }}>
            <div style={{
              width: '26px',
              height: '26px',
              borderRadius: '3px',
              backgroundColor: 'var(--color-ink)',
              color: '#FAF7F2',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Sparkles size={14} className="spin" />
            </div>
            <div style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--color-ink)',
              borderRadius: '4px',
              padding: '0.6rem 0.85rem',
              fontSize: '0.82rem',
              color: 'var(--color-ink-muted)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem'
            }}>
              <span>Scanning transcript & verifying grounding...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Bottom Input Area */}
      <div style={{
        padding: '0.85rem 1rem',
        borderTop: '2px solid var(--color-ink)',
        backgroundColor: 'var(--bg-card)'
      }}>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <input
            type="text"
            value={inputQuestion}
            onChange={(e) => setInputQuestion(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question about this meeting (e.g. What deadlines were set?)..."
            disabled={loading}
            style={{
              flex: 1,
              padding: '0.65rem 0.85rem',
              fontSize: '0.86rem',
              backgroundColor: 'var(--bg-primary)',
              border: '1.5px solid var(--color-ink)',
              borderRadius: '3px',
              color: 'var(--color-ink)',
              outline: 'none'
            }}
          />

          <button
            onClick={() => handleSendQuestion()}
            disabled={loading || !inputQuestion.trim()}
            className="btn-burgundy"
            style={{
              padding: '0.65rem 1.15rem',
              fontSize: '0.86rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              borderRadius: '3px',
              cursor: loading || !inputQuestion.trim() ? 'not-allowed' : 'pointer',
              opacity: loading || !inputQuestion.trim() ? 0.6 : 1
            }}
          >
            <Send size={14} />
            <span>Ask</span>
          </button>
        </div>

        <div style={{
          marginTop: '0.4rem',
          fontSize: '0.70rem',
          color: 'var(--color-ink-muted)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <span>Press <strong>Enter</strong> to send • Isolated to this transcript</span>
          <span>Answers cite exact audio timestamps</span>
        </div>
      </div>
    </div>
  );
}
