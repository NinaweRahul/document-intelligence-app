'use client';

import { useState, useRef, useEffect } from 'react';
import { Upload, Send, FileText, RotateCcw, Loader2, MessageSquare, AlertCircle, Sun, Moon } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

type Theme = 'light' | 'dark';

// Exact tokens from portfolio
const LIGHT = {
  bg: '#F4F6F2', surface: '#FFFFFF', ink: '#111A0F', mid: '#2D4228',
  muted: '#7A9472', rule: '#D8E4D2', accent: '#1A6B4A',
  accentLight: '#EAF3EE', accentInk: '#FFFFFF',
  shadow: '0 4px 24px rgba(0,0,0,0.07)',
};
const DARK = {
  bg: '#0E0E0E', surface: '#161616', ink: '#F5F5F0', mid: '#A0A09A',
  muted: '#555550', rule: '#242420', accent: '#D4AF6A',
  accentLight: 'rgba(212,175,106,0.10)', accentInk: '#0E0E0E',
  shadow: '0 4px 24px rgba(0,0,0,0.40)',
};

interface Message {
  role: 'user' | 'assistant';
  content: string;
  similarityScore?: number;
  isInScope?: boolean;
}
interface DocumentInfo {
  sessionId: string; filename: string; pageCount: number; chunkCount: number;
}

function ConfidenceBadge({ score, isInScope, t }: { score: number; isInScope: boolean; t: typeof LIGHT }) {
  const isDark = t === DARK;
  if (!isInScope && score < 0.45) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, padding: '4px 12px', borderRadius: 999, background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.25)' }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#f87171', display: 'inline-block' }} />
        Not found in document
      </span>
    );
  }
  const level = score >= 0.65 ? 'high' : score >= 0.45 ? 'medium' : 'low';
  const conf = {
    high:   { label: 'High confidence',   c: isDark ? '#D4AF6A' : t.accent, b: isDark ? 'rgba(212,175,106,0.1)' : t.accentLight, bd: isDark ? 'rgba(212,175,106,0.25)' : t.rule },
    medium: { label: 'Medium confidence', c: '#D97706', b: 'rgba(217,119,6,0.08)', bd: 'rgba(217,119,6,0.25)' },
    low:    { label: 'Low confidence',    c: '#ef4444', b: 'rgba(239,68,68,0.08)', bd: 'rgba(239,68,68,0.25)' },
  }[level];
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, padding: '4px 12px', borderRadius: 999, background: conf.b, color: conf.c, border: `1px solid ${conf.bd}` }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: conf.c, display: 'inline-block' }} />
      {conf.label} · {(score * 100).toFixed(0)}%
    </span>
  );
}

const css = (theme: Theme) => `
  @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,700;0,9..144,900;1,9..144,400&family=Outfit:wght@300;400;500;600&display=swap');
  .doc-app *, .doc-app *::before, .doc-app *::after { box-sizing: border-box; }
  .doc-app { font-family: "Outfit", sans-serif; -webkit-font-smoothing: antialiased; }
  .doc-app input, .doc-app button { font-family: "Outfit", sans-serif; }
  .doc-app .upload-zone { transition: all 0.3s ease; }
  .doc-app .upload-zone:hover { 
    border-color: ${theme === 'light' ? LIGHT.accent : DARK.accent} !important; 
    box-shadow: 0 0 40px ${theme === 'light' ? 'rgba(26,107,74,0.12)' : 'rgba(212,175,106,0.12)'};
    transform: scale(1.005);
  }
  .doc-app .how-card { transition: all 0.2s ease; cursor: default; }
  .doc-app .how-card:hover { 
    border-color: ${theme === 'light' ? LIGHT.accent : DARK.accent} !important; 
    box-shadow: ${theme === 'light' ? '0 8px 32px rgba(26,107,74,0.1)' : '0 8px 32px rgba(212,175,106,0.1)'};
    transform: translateY(-2px);
  }
  .doc-app .chip { transition: all 0.2s ease; }
  .doc-app .chip:hover { 
    background: ${theme === 'light' ? LIGHT.accent : DARK.accent} !important; 
    color: ${theme === 'light' ? LIGHT.accentInk : DARK.accentInk} !important; 
    border-color: ${theme === 'light' ? LIGHT.accent : DARK.accent} !important;
    transform: translateY(-1px);
    box-shadow: ${theme === 'light' ? '0 4px 16px rgba(26,107,74,0.2)' : '0 4px 16px rgba(212,175,106,0.2)'};
  }
  .doc-app .theme-btn { transition: all 0.2s ease; }
  .doc-app .theme-btn:hover { border-color: ${theme === 'light' ? LIGHT.accent : DARK.accent} !important; transform: scale(1.08); }
  .doc-app .reset-btn { transition: all 0.2s ease; }
  .doc-app .reset-btn:hover { color: ${theme === 'light' ? LIGHT.accent : DARK.accent} !important; border-color: ${theme === 'light' ? LIGHT.accent : DARK.accent} !important; }
  .doc-app .send-btn:not(:disabled) { transition: all 0.2s ease; }
  .doc-app .send-btn:not(:disabled):hover { opacity: 0.88; transform: scale(1.05); box-shadow: ${theme === 'light' ? '0 4px 16px rgba(26,107,74,0.3)' : '0 4px 16px rgba(212,175,106,0.3)'}; }
  .doc-app .send-btn:not(:disabled):active { transform: scale(0.96); }
  .doc-app .gh-link { transition: color 0.2s; }
  .doc-app .gh-link:hover { color: ${theme === 'light' ? LIGHT.accent : DARK.accent} !important; }
`;

export default function Home() {
  const [theme, setTheme] = useState<Theme>('light');
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
  const t = theme === 'light' ? LIGHT : DARK;

  useEffect(() => {
    fetch(`${API_URL}/`).then(() => setServerReady(true)).catch(() => setServerReady(true));
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
      setMessages(prev => [...prev, { role: 'assistant', content: data.answer, similarityScore: data.similarity_score, isInScope: data.is_in_scope }]);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Something went wrong. Please try again.' }]);
    } finally { setIsAsking(false); }
  }

  function handleReset() { setDoc(null); setMessages([]); setInput(''); setUploadError(''); }

  const Header = () => (
    <header style={{ position: 'sticky', top: 0, zIndex: 100, padding: '18px 40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${t.rule}`, background: t.bg === '#F4F6F2' ? 'rgba(244,246,242,0.96)' : 'rgba(14,14,14,0.96)', backdropFilter: 'blur(12px)', transition: 'all 0.3s' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 38, height: 38, borderRadius: 10, background: t.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: t.shadow }}>
          <MessageSquare size={17} color={t.accentInk} />
        </div>
        <div>
          <div style={{ fontFamily: '"Fraunces", serif', fontWeight: 900, fontSize: 15, color: t.ink, letterSpacing: '-0.01em' }}>Document Intelligence</div>
          <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: t.accent }}>Powered by RAG + Gemini</div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        {doc && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 100, padding: '8px 16px', boxShadow: t.shadow }}>
            <FileText size={13} color={t.accent} />
            <span style={{ fontSize: 13, fontWeight: 600, color: t.ink, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.filename}</span>
            <span style={{ fontSize: 12, color: t.muted }}>{doc.pageCount}p</span>
          </div>
        )}
        <a href="https://ninawerahul.github.io" target="_blank" rel="noopener noreferrer" className="gh-link"
          style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: t.muted, textDecoration: 'none' }}>
          Portfolio
        </a>
        <a href="https://github.com/NinaweRahul/document-intelligence-app" target="_blank" rel="noopener noreferrer" className="gh-link"
          style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: t.muted, textDecoration: 'none' }}>
          GitHub
        </a>
        {doc && (
          <button className="reset-btn" onClick={handleReset} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: t.muted, background: 'none', border: `1.5px solid ${t.rule}`, borderRadius: 8, padding: '8px 14px', cursor: 'pointer' }}>
            <RotateCcw size={13} /> New doc
          </button>
        )}
        <button className="theme-btn" onClick={() => setTheme(t => t === 'light' ? 'dark' : 'light')}
          style={{ width: 40, height: 40, borderRadius: '50%', border: `1.5px solid ${t.rule}`, background: t.surface, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, boxShadow: t.shadow }}>
          {theme === 'light' ? <Moon size={16} color={t.muted} /> : <Sun size={16} color={t.accent} />}
        </button>
      </div>
    </header>
  );

  // Landing page
  if (!doc) {
    return (
      <div className="doc-app" style={{ minHeight: '100vh', background: t.bg, color: t.ink, transition: 'background 0.3s, color 0.3s' }}>
        <style>{css(theme)}</style>
        <Header />

        <div style={{ maxWidth: 660, margin: '0 auto', padding: '72px 24px 40px', textAlign: 'center' }}>

          {/* Eyebrow */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 32 }}>
            <span style={{ width: 24, height: 1, background: t.accent, display: 'inline-block' }} />
            <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.18em', textTransform: 'uppercase', color: t.accent }}>Document Q&A</span>
            <span style={{ width: 24, height: 1, background: t.accent, display: 'inline-block' }} />
          </div>

          {/* Heading */}
          <h1 style={{ fontFamily: '"Fraunces", serif', fontWeight: 900, fontSize: 'clamp(3rem, 6vw, 5rem)', lineHeight: 0.95, letterSpacing: '-0.03em', color: t.ink, marginBottom: 24 }}>
            Ask anything about<br />
            <em style={{ fontStyle: 'italic', fontWeight: 300, color: t.accent }}>any document</em>
          </h1>

          <p style={{ fontSize: 17, fontWeight: 300, color: t.mid, lineHeight: 1.7, marginBottom: 48 }}>
            Upload a PDF and get instant answers in plain English.<br />
            No searching, no scrolling — just ask.
          </p>

          {/* Status pill */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 100, padding: '8px 18px', marginBottom: 32, boxShadow: t.shadow }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: serverReady ? '#4ade80' : t.accent, display: 'inline-block', animation: serverReady ? 'none' : 'none', opacity: serverReady ? 1 : 0.8 }} />
            <span style={{ fontSize: 13, fontWeight: 500, color: serverReady ? (theme === 'light' ? '#1A6B4A' : '#4ade80') : t.mid }}>
              {serverReady ? 'Ready — drop a PDF to get started' : 'Starting up, just a moment...'}
            </span>
          </div>

          {/* Upload Zone */}
          <div
            className="upload-zone"
            style={{
              border: `2px dashed ${isDragging ? t.accent : t.rule}`,
              borderRadius: 20,
              padding: '56px 40px',
              cursor: isUploading ? 'default' : 'pointer',
              background: isDragging ? t.accentLight : t.surface,
              marginBottom: 16,
              boxShadow: t.shadow,
            }}
            onClick={() => !isUploading && fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files[0]; if (f) handleUpload(f); }}
          >
            <input ref={fileInputRef} type="file" accept=".pdf" style={{ display: 'none' }}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); }} />

            {isUploading ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
                <div style={{ width: 64, height: 64, borderRadius: 18, background: t.accentLight, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${t.rule}` }}>
                  <Loader2 size={32} color={t.accent} className="animate-spin" />
                </div>
                <div>
                  <div style={{ fontSize: 20, fontWeight: 700, fontFamily: '"Fraunces", serif', color: t.ink, marginBottom: 6 }}>Reading your document...</div>
                  <div style={{ fontSize: 14, color: t.muted, fontWeight: 300 }}>Almost ready — this takes about 20 seconds</div>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
                <div style={{ width: 64, height: 64, borderRadius: 18, background: isDragging ? t.accent : t.accentLight, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${t.rule}`, transition: 'all 0.3s' }}>
                  <Upload size={30} color={isDragging ? t.accentInk : t.accent} />
                </div>
                <div>
                  <div style={{ fontSize: 20, fontWeight: 700, fontFamily: '"Fraunces", serif', color: t.ink, marginBottom: 6 }}>Drop your PDF here</div>
                  <div style={{ fontSize: 14, color: t.muted, fontWeight: 300 }}>or click to browse files</div>
                </div>
                <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: t.muted, background: t.bg, padding: '5px 14px', borderRadius: 100, border: `1px solid ${t.rule}` }}>
                  PDF only
                </div>
              </div>
            )}
          </div>

          {uploadError && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: '#ef4444', marginBottom: 16 }}>
              <AlertCircle size={15} />
              <span style={{ fontSize: 14, fontWeight: 500 }}>{uploadError}</span>
            </div>
          )}
        </div>

        {/* How it works */}
        <div style={{ maxWidth: 660, margin: '0 auto', padding: '0 24px 80px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            {[
              { icon: Upload, num: '01', label: 'Upload', desc: 'Drop any PDF — reports, research papers, contracts, anything.' },
              { icon: MessageSquare, num: '02', label: 'Ask', desc: 'Type a question in plain English and get a direct answer.' },
              { icon: FileText, num: '03', label: 'Verify', desc: 'Each answer shows a confidence score — no hallucinations.' },
            ].map((step) => (
              <div key={step.num} className="how-card" style={{ background: t.surface, borderRadius: 16, padding: '24px 20px', border: `1px solid ${t.rule}`, boxShadow: t.shadow }}>
                <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.15em', textTransform: 'uppercase', color: t.accent, marginBottom: 16 }}>{step.num}</div>
                <div style={{ width: 40, height: 40, borderRadius: 12, background: t.accentLight, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14, border: `1px solid ${t.rule}` }}>
                  <step.icon size={20} color={t.accent} />
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, color: t.ink, marginBottom: 8, fontFamily: '"Fraunces", serif' }}>{step.label}</div>
                <div style={{ fontSize: 13, color: t.muted, lineHeight: 1.6, fontWeight: 300 }}>{step.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Chat view
  return (
    <div className="doc-app" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: t.bg, color: t.ink, transition: 'background 0.3s, color 0.3s' }}>
      <style>{css(theme)}</style>
      <Header />

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '32px 24px' }}>
        <div style={{ maxWidth: 660, margin: '0 auto' }}>
          {messages.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 24, paddingTop: 64 }}>
              <div style={{ width: 80, height: 80, borderRadius: 24, background: t.accentLight, border: `1px solid ${t.rule}`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: t.shadow }}>
                <MessageSquare size={38} color={t.accent} />
              </div>
              <div>
                <div style={{ fontFamily: '"Fraunces", serif', fontWeight: 900, fontSize: 28, color: t.ink, marginBottom: 8, letterSpacing: '-0.02em' }}>Your document is ready</div>
                <div style={{ fontSize: 15, color: t.muted, fontWeight: 300 }}>Ask anything about it below</div>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center', marginTop: 8 }}>
                {['What is the main topic?', 'Summarize the key points', 'What are the conclusions?'].map((s) => (
                  <button key={s} className="chip" onClick={() => setInput(s)} style={{
                    fontSize: 13, fontWeight: 500, padding: '10px 18px', borderRadius: 100,
                    background: t.surface, border: `1.5px solid ${t.rule}`, color: t.mid,
                    cursor: 'pointer', boxShadow: t.shadow,
                  }}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {messages.map((msg, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                  <div style={{
                    maxWidth: '80%',
                    borderRadius: msg.role === 'user' ? '20px 20px 4px 20px' : '20px 20px 20px 4px',
                    padding: '14px 18px',
                    background: msg.role === 'user' ? t.accent : t.surface,
                    border: msg.role === 'user' ? 'none' : `1px solid ${t.rule}`,
                    boxShadow: t.shadow,
                  }}>
                    {msg.role === 'user' ? (
                      <p style={{ fontSize: 15, lineHeight: 1.6, fontWeight: 400, color: t.accentInk, margin: 0 }}>{msg.content}</p>
                    ) : (
                      <div style={{ fontSize: 15, lineHeight: 1.7, color: t.ink }}>
                        <ReactMarkdown
                          components={{
                            strong: ({ children }) => <strong style={{ fontWeight: 700, color: t.ink }}>{children}</strong>,
                            ul: ({ children }) => <ul style={{ paddingLeft: 20, marginTop: 8, marginBottom: 8 }}>{children}</ul>,
                            li: ({ children }) => <li style={{ color: t.mid, marginBottom: 4 }}>{children}</li>,
                            p: ({ children }) => <p style={{ margin: '0 0 8px 0' }}>{children}</p>,
                          }}
                        >
                          {msg.content}
                        </ReactMarkdown>
                      </div>
                    )}
                    {msg.role === 'assistant' && msg.similarityScore !== undefined && (
                      <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${t.rule}` }}>
                        <ConfidenceBadge score={msg.similarityScore} isInScope={msg.isInScope ?? false} t={t} />
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {isAsking && (
                <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                  <div style={{ background: t.surface, border: `1px solid ${t.rule}`, borderRadius: '20px 20px 20px 4px', padding: '14px 18px', boxShadow: t.shadow }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      {[0, 150, 300].map((delay) => (
                        <span key={delay} className="animate-bounce" style={{ width: 7, height: 7, borderRadius: '50%', background: t.accent, display: 'inline-block', animationDelay: `${delay}ms` }} />
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
      <div style={{ padding: '12px 24px 32px', borderTop: `1px solid ${t.rule}` }}>
        <div style={{ maxWidth: 660, margin: '0 auto' }}>
          <div style={{ display: 'flex', gap: 10, background: t.surface, border: `1.5px solid ${t.rule}`, borderRadius: 16, padding: 8, boxShadow: t.shadow }}>
            <input
              type="text" value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
              placeholder="Ask a question about your document..."
              disabled={isAsking}
              style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', padding: '10px 14px', fontSize: 15, color: t.ink, fontWeight: 400 }}
            />
            <button className="send-btn" onClick={handleSend} disabled={!input.trim() || isAsking}
              style={{ width: 44, height: 44, borderRadius: 12, border: 'none', cursor: !input.trim() || isAsking ? 'not-allowed' : 'pointer', background: !input.trim() || isAsking ? t.rule : t.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {isAsking
                ? <Loader2 size={19} color={t.accent} className="animate-spin" />
                : <Send size={19} color={!input.trim() ? t.muted : t.accentInk} />
              }
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}