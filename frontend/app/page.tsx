'use client';

import { useState, useRef, useEffect } from 'react';
import { Upload, Send, FileText, RotateCcw, Loader2, MessageSquare, AlertCircle, Zap } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  similarityScore?: number;
  isInScope?: boolean;
}

interface DocumentInfo {
  sessionId: string;
  filename: string;
  pageCount: number;
  chunkCount: number;
}

function ConfidenceBadge({ score, isInScope }: { score: number; isInScope: boolean }) {
  if (!isInScope && score < 0.45) {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm px-3 py-1 rounded-full border"
        style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', borderColor: 'rgba(239,68,68,0.3)' }}>
        <span className="w-2 h-2 rounded-full bg-red-400" />
        Not found in document
      </span>
    );
  }
  const level = score >= 0.65 ? 'high' : score >= 0.45 ? 'medium' : 'low';
  const config = {
    high:   { label: 'High confidence',   color: '#4ade80', bg: 'rgba(74,222,128,0.08)',  border: 'rgba(74,222,128,0.25)',  dot: '#4ade80'  },
    medium: { label: 'Medium confidence', color: '#D4A017', bg: 'rgba(212,160,23,0.08)',  border: 'rgba(212,160,23,0.25)',  dot: '#D4A017'  },
    low:    { label: 'Low confidence',    color: '#f87171', bg: 'rgba(248,113,113,0.08)', border: 'rgba(248,113,113,0.25)', dot: '#f87171'  },
  }[level];
  return (
    <span className="inline-flex items-center gap-1.5 text-sm px-3 py-1 rounded-full border"
      style={{ background: config.bg, color: config.color, borderColor: config.border }}>
      <span className="w-2 h-2 rounded-full" style={{ background: config.dot }} />
      {config.label} · {(score * 100).toFixed(0)}%
    </span>
  );
}

export default function Home() {
  const [doc, setDoc] = useState<DocumentInfo | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isAsking, setIsAsking] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [serverReady, setServerReady] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`${API_URL}/`)
      .then(() => setServerReady(true))
      .catch(() => setServerReady(true));
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleUpload(file: File) {
    if (!file.name.endsWith('.pdf')) { setUploadError('Only PDF files are supported.'); return; }
    setIsUploading(true); setUploadError('');
    const form = new FormData();
    form.append('file', file);
    try {
      const res = await fetch(`${API_URL}/upload`, { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Upload failed');
      setDoc({ sessionId: data.session_id, filename: data.filename, pageCount: data.page_count, chunkCount: data.chunk_count });
      setMessages([]);
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
    } finally { setIsUploading(false); }
  }

  async function handleSend() {
    if (!input.trim() || !doc || isAsking) return;
    const question = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: question }]);
    setIsAsking(true);
    try {
      const res = await fetch(`${API_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: doc.sessionId, question }),
      });
      const data = await res.json();
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.answer,
        similarityScore: data.similarity_score,
        isInScope: data.is_in_scope,
      }]);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Something went wrong. Please try again.' }]);
    } finally { setIsAsking(false); }
  }

  function handleReset() { setDoc(null); setMessages([]); setInput(''); setUploadError(''); }

  const baseStyle = {
    background: '#0A0A0A',
    fontFamily: "'Outfit', sans-serif",
    color: '#F5F5F5',
    minHeight: '100vh',
  };

  const fonts = (
    <link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,400;0,700;1,400&family=Outfit:wght@400;500;600;700&display=swap" rel="stylesheet" />
  );

  if (!doc) {
    return (
      <div style={baseStyle}>
        {fonts}

        {/* Header */}
        <header style={{ borderBottom: '1px solid #1a1a1a', padding: '20px 40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(10,10,10,0.8)', backdropFilter: 'blur(12px)', position: 'sticky', top: 0, zIndex: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: 'linear-gradient(135deg, #22c55e, #16a34a)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 20px rgba(34,197,94,0.3)' }}>
              <MessageSquare size={18} color="white" />
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#F5F5F5', fontFamily: "'Fraunces', serif" }}>Document Intelligence</div>
              <div style={{ fontSize: 11, color: '#4ade80', fontWeight: 600, letterSpacing: '0.1em' }}>POWERED BY RAG + GEMINI</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <a href="https://ninawerahul.github.io" target="_blank" rel="noopener noreferrer"
              style={{ fontSize: 13, color: '#D4A017', fontWeight: 600, textDecoration: 'none' }}>
              Portfolio →
            </a>
            <a href="https://github.com/NinaweRahul/document-intelligence-app" target="_blank" rel="noopener noreferrer"
              style={{ fontSize: 13, color: '#888', fontWeight: 600, textDecoration: 'none' }}>
              GitHub →
            </a>
          </div>
        </header>

        {/* Hero */}
        <div style={{ maxWidth: 680, margin: '0 auto', padding: '80px 24px 40px', textAlign: 'center' }}>

          {/* Status pill */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#141414', border: '1px solid #262626', borderRadius: 999, padding: '8px 16px', marginBottom: 40 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: serverReady ? '#4ade80' : '#D4A017', display: 'inline-block', animation: serverReady ? 'none' : 'pulse 1.5s infinite' }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: serverReady ? '#4ade80' : '#D4A017' }}>
              {serverReady ? 'Ready — drop a PDF to get started' : 'Starting up, just a moment...'}
            </span>
          </div>

          <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 56, fontWeight: 700, lineHeight: 1.1, marginBottom: 20, color: '#F5F5F5' }}>
            Ask anything about<br />
            <em style={{ color: '#4ade80', fontStyle: 'italic' }}>any document</em>
          </h2>
          <p style={{ fontSize: 18, color: '#888', fontWeight: 500, marginBottom: 48, lineHeight: 1.6 }}>
            Upload a PDF and get instant answers in plain English.<br />
            No searching, no scrolling — just ask.
          </p>

          {/* Upload Zone */}
          <div
            style={{
              border: `2px dashed ${isDragging ? '#4ade80' : '#262626'}`,
              borderRadius: 24,
              padding: '64px 48px',
              cursor: isUploading ? 'default' : 'pointer',
              transition: 'all 0.3s ease',
              background: isDragging ? 'rgba(74,222,128,0.05)' : '#111111',
              transform: isDragging ? 'scale(1.01)' : 'scale(1)',
              boxShadow: isDragging ? '0 0 40px rgba(74,222,128,0.15)' : 'none',
            }}
            onClick={() => !isUploading && fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files[0]; if (f) handleUpload(f); }}
          >
            <input ref={fileInputRef} type="file" accept=".pdf" style={{ display: 'none' }}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); }} />

            {isUploading ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
                <div style={{ width: 72, height: 72, borderRadius: 20, background: 'rgba(74,222,128,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(74,222,128,0.2)' }}>
                  <Loader2 size={36} color="#4ade80" className="animate-spin" />
                </div>
                <div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: '#F5F5F5', marginBottom: 6 }}>Reading your document...</div>
                  <div style={{ fontSize: 15, color: '#888' }}>Almost ready — this takes about 20 seconds</div>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
                <div style={{
                  width: 72, height: 72, borderRadius: 20,
                  background: isDragging ? 'linear-gradient(135deg, #22c55e, #16a34a)' : 'rgba(74,222,128,0.1)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: `1px solid ${isDragging ? 'transparent' : 'rgba(74,222,128,0.2)'}`,
                  transition: 'all 0.3s ease',
                  boxShadow: isDragging ? '0 0 30px rgba(34,197,94,0.4)' : 'none',
                }}>
                  <Upload size={36} color={isDragging ? 'white' : '#4ade80'} />
                </div>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: '#F5F5F5', marginBottom: 6 }}>Drop your PDF here</div>
                  <div style={{ fontSize: 15, color: '#888' }}>or click to browse files</div>
                </div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#555', background: '#1a1a1a', padding: '6px 14px', borderRadius: 999, border: '1px solid #262626' }}>
                  PDF files only
                </div>
              </div>
            )}
          </div>

          {uploadError && (
            <div style={{ marginTop: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: '#f87171' }}>
              <AlertCircle size={16} />
              <span style={{ fontSize: 15, fontWeight: 500 }}>{uploadError}</span>
            </div>
          )}
        </div>

        {/* How it works */}
        <div style={{ maxWidth: 680, margin: '0 auto', padding: '0 24px 80px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
            {[
              { icon: Upload,        label: 'Upload', desc: 'Drop any PDF — reports, research, contracts, anything.', accent: '#4ade80' },
              { icon: MessageSquare, label: 'Ask',    desc: 'Type a question in plain English and get a direct answer.', accent: '#D4A017' },
              { icon: Zap,           label: 'Verify', desc: 'Each answer shows a confidence score — no hallucinations.', accent: '#818cf8' },
            ].map((step, i) => (
              <div key={i} style={{
                background: '#111111', borderRadius: 20, padding: 24,
                border: '1px solid #1a1a1a', cursor: 'default',
                transition: 'all 0.2s ease',
              }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = step.accent; (e.currentTarget as HTMLDivElement).style.boxShadow = `0 0 20px ${step.accent}20`; }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = '#1a1a1a'; (e.currentTarget as HTMLDivElement).style.boxShadow = 'none'; }}
              >
                <div style={{ width: 44, height: 44, borderRadius: 14, background: `${step.accent}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16, border: `1px solid ${step.accent}30` }}>
                  <step.icon size={22} color={step.accent} />
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#F5F5F5', marginBottom: 8 }}>{step.label}</div>
                <div style={{ fontSize: 13, color: '#666', lineHeight: 1.6 }}>{step.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Chat view
  return (
    <div style={{ ...baseStyle, display: 'flex', flexDirection: 'column' }}>
      {fonts}

      {/* Header */}
      <header style={{ borderBottom: '1px solid #1a1a1a', padding: '16px 40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(10,10,10,0.9)', backdropFilter: 'blur(12px)', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: 'linear-gradient(135deg, #22c55e, #16a34a)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 20px rgba(34,197,94,0.3)' }}>
            <MessageSquare size={18} color="white" />
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#F5F5F5', fontFamily: "'Fraunces', serif" }}>Document Intelligence</div>
            <div style={{ fontSize: 11, color: '#4ade80', fontWeight: 600, letterSpacing: '0.1em' }}>POWERED BY RAG + GEMINI</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#141414', border: '1px solid #262626', borderRadius: 16, padding: '10px 16px' }}>
            <FileText size={15} color="#4ade80" />
            <span style={{ fontSize: 14, fontWeight: 700, color: '#F5F5F5', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.filename}</span>
            <span style={{ fontSize: 13, color: '#555', fontWeight: 500 }}>{doc.pageCount} pages</span>
          </div>
          <button onClick={handleReset} style={{
            display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600,
            color: '#888', background: 'none', border: '1px solid #262626', borderRadius: 12,
            padding: '10px 16px', cursor: 'pointer', transition: 'all 0.2s ease',
            fontFamily: "'Outfit', sans-serif",
          }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#D4A017'; (e.currentTarget as HTMLButtonElement).style.borderColor = '#D4A017'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#888'; (e.currentTarget as HTMLButtonElement).style.borderColor = '#262626'; }}
          >
            <RotateCcw size={14} /> New document
          </button>
        </div>
      </header>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '32px 24px' }}>
        <div style={{ maxWidth: 680, margin: '0 auto' }}>
          {messages.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: 24, paddingTop: 80 }}>
              <div style={{ width: 88, height: 88, borderRadius: 28, background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 40px rgba(74,222,128,0.1)' }}>
                <MessageSquare size={44} color="#4ade80" />
              </div>
              <div>
                <div style={{ fontSize: 32, fontWeight: 700, color: '#F5F5F5', fontFamily: "'Fraunces', serif", marginBottom: 8 }}>Your document is ready</div>
                <div style={{ fontSize: 17, color: '#888', fontWeight: 500 }}>Ask anything about it below</div>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center', marginTop: 8 }}>
                {['What is the main topic?', 'Summarize the key points', 'What are the conclusions?'].map((s) => (
                  <button key={s} onClick={() => setInput(s)} style={{
                    fontSize: 14, fontWeight: 600, padding: '12px 20px', borderRadius: 16,
                    background: '#141414', border: '1px solid #262626', color: '#888',
                    cursor: 'pointer', transition: 'all 0.2s ease', fontFamily: "'Outfit', sans-serif",
                  }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#4ade80'; (e.currentTarget as HTMLButtonElement).style.color = '#4ade80'; (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 0 20px rgba(74,222,128,0.15)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#262626'; (e.currentTarget as HTMLButtonElement).style.color = '#888'; (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none'; }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {messages.map((msg, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                  <div style={{
                    maxWidth: '80%',
                    borderRadius: msg.role === 'user' ? '24px 24px 6px 24px' : '24px 24px 24px 6px',
                    padding: '16px 20px',
                    background: msg.role === 'user' ? 'linear-gradient(135deg, #22c55e, #16a34a)' : '#141414',
                    border: msg.role === 'user' ? 'none' : '1px solid #1e1e1e',
                    boxShadow: msg.role === 'user' ? '0 4px 20px rgba(34,197,94,0.25)' : '0 2px 8px rgba(0,0,0,0.3)',
                  }}>
                    {msg.role === 'user' ? (
                      <p style={{ fontSize: 15, lineHeight: 1.6, fontWeight: 500, color: 'white', margin: 0 }}>{msg.content}</p>
                    ) : (
                      <div style={{ fontSize: 15, lineHeight: 1.7, fontWeight: 400, color: '#E5E5E5' }}>
                        <ReactMarkdown
                          components={{
                            strong: ({children}) => <strong style={{ fontWeight: 700, color: '#F5F5F5' }}>{children}</strong>,
                            ul: ({children}) => <ul style={{ listStyleType: 'disc', paddingLeft: 20, marginTop: 8, marginBottom: 8 }}>{children}</ul>,
                            li: ({children}) => <li style={{ color: '#D4D4D4', marginBottom: 4 }}>{children}</li>,
                            p: ({children}) => <p style={{ margin: '0 0 8px', lastChild: 'margin-bottom: 0' } as React.CSSProperties}>{children}</p>,
                          }}
                        >
                          {msg.content}
                        </ReactMarkdown>
                      </div>
                    )}
                    {msg.role === 'assistant' && msg.similarityScore !== undefined && (
                      <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #262626' }}>
                        <ConfidenceBadge score={msg.similarityScore} isInScope={msg.isInScope ?? false} />
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {isAsking && (
                <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                  <div style={{ background: '#141414', border: '1px solid #1e1e1e', borderRadius: '24px 24px 24px 6px', padding: '16px 20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {[0, 150, 300].map((delay) => (
                        <span key={delay} className="animate-bounce" style={{ width: 8, height: 8, borderRadius: '50%', background: '#4ade80', display: 'inline-block', animationDelay: `${delay}ms` }} />
                      ))}
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
      </div>

      {/* Input */}
      <div style={{ padding: '16px 24px 32px' }}>
        <div style={{ maxWidth: 680, margin: '0 auto' }}>
          <div style={{ display: 'flex', gap: 12, background: '#141414', border: '1px solid #262626', borderRadius: 20, padding: 8, boxShadow: '0 0 40px rgba(0,0,0,0.4)' }}>
            <input
              type="text" value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
              placeholder="Ask a question about your document..."
              disabled={isAsking}
              style={{
                flex: 1, background: 'transparent', border: 'none', outline: 'none',
                padding: '12px 16px', fontSize: 15, color: '#F5F5F5',
                fontFamily: "'Outfit', sans-serif", fontWeight: 500,
              }}
            />
            <button onClick={handleSend} disabled={!input.trim() || isAsking}
              style={{
                width: 48, height: 48, borderRadius: 14, border: 'none', cursor: !input.trim() || isAsking ? 'not-allowed' : 'pointer',
                background: !input.trim() || isAsking ? '#1a1a1a' : 'linear-gradient(135deg, #22c55e, #16a34a)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.2s ease', flexShrink: 0,
                boxShadow: !input.trim() || isAsking ? 'none' : '0 4px 15px rgba(34,197,94,0.3)',
              }}>
              {isAsking
                ? <Loader2 size={20} color="#4ade80" className="animate-spin" />
                : <Send size={20} color={!input.trim() ? '#444' : 'white'} />
              }
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}