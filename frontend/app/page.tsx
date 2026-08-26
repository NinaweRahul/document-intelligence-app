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
      <span className="inline-flex items-center gap-1.5 text-sm px-3 py-1 rounded-full bg-red-50 text-red-500 border border-red-200">
        <span className="w-2 h-2 rounded-full bg-red-400" />
        Out of scope
      </span>
    );
  }
  const level = score >= 0.65 ? 'high' : score >= 0.45 ? 'medium' : 'low';
  const config = {
    high:   { label: 'High confidence',   color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', dot: 'bg-emerald-500' },
    medium: { label: 'Medium confidence', color: 'text-amber-600',   bg: 'bg-amber-50',   border: 'border-amber-200',   dot: 'bg-amber-500'   },
    low:    { label: 'Low confidence',    color: 'text-red-600',     bg: 'bg-red-50',     border: 'border-red-200',     dot: 'bg-red-500'     },
  }[level];
  return (
    <span className={`inline-flex items-center gap-1.5 text-sm px-3 py-1 rounded-full ${config.bg} ${config.color} border ${config.border}`}>
      <span className={`w-2 h-2 rounded-full ${config.dot}`} />
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

  if (!doc) {
    return (
      <div className="min-h-screen" style={{
        background: 'linear-gradient(135deg, #EFF6FF 0%, #EEF2FF 50%, #F5F3FF 100%)',
        fontFamily: "'Plus Jakarta Sans', sans-serif"
      }}>
        <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />

        {/* Header */}
        <header className="px-8 py-5 flex items-center justify-between border-b border-indigo-100 bg-white/60 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-200">
              <MessageSquare className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold text-indigo-950">Document Intelligence</h1>
              <p className="text-xs text-indigo-400 font-semibold tracking-wide">POWERED BY RAG + GEMINI</p>
            </div>
          </div>
          <a href="https://github.com/NinaweRahul/document-intelligence-app"
            target="_blank" rel="noopener noreferrer"
            className="text-sm font-semibold text-indigo-500 hover:text-indigo-700 px-4 py-2 rounded-2xl hover:bg-white/80 transition-all duration-200">
            GitHub →
          </a>
        </header>

        {/* Hero */}
        <div className="max-w-2xl mx-auto px-6 pt-16 pb-8 text-center">
          <div className="inline-flex items-center gap-2 bg-white border border-indigo-200 rounded-full px-4 py-2 mb-8 shadow-sm">
            <span className={`w-2 h-2 rounded-full ${serverReady ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'}`} />
            <span className="text-sm font-semibold text-indigo-700">
              {serverReady ? 'Server ready — upload to begin' : 'Warming up server...'}
            </span>
          </div>

          <h2 className="text-5xl font-extrabold text-indigo-950 mb-5 leading-tight tracking-tight">
            Ask anything about<br />
            <span className="text-indigo-600">any document</span>
          </h2>
          <p className="text-lg text-indigo-400 font-medium mb-10 leading-relaxed">
            Upload a PDF and get instant, grounded answers<br />powered by RAG and semantic search.
          </p>

          {/* Upload Zone */}
          <div
            className={`border-2 border-dashed rounded-3xl p-14 cursor-pointer transition-all duration-300 bg-white/70 backdrop-blur-sm ${
              isDragging
                ? 'border-indigo-500 bg-indigo-50/80 scale-[1.02] shadow-2xl shadow-indigo-100'
                : 'border-indigo-200 hover:border-indigo-400 hover:bg-white/90 hover:shadow-2xl hover:shadow-indigo-100 hover:scale-[1.01]'
            }`}
            onClick={() => !isUploading && fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files[0]; if (f) handleUpload(f); }}
          >
            <input ref={fileInputRef} type="file" accept=".pdf" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); }} />

            {isUploading ? (
              <div className="flex flex-col items-center gap-5">
                <div className="w-20 h-20 rounded-3xl bg-indigo-100 flex items-center justify-center">
                  <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
                </div>
                <div>
                  <p className="text-xl font-bold text-indigo-900">Indexing your document...</p>
                  <p className="text-base text-indigo-400 mt-1">Chunking and embedding — takes about 20 seconds</p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-5">
                <div className={`w-20 h-20 rounded-3xl flex items-center justify-center transition-all duration-300 ${
                  isDragging ? 'bg-indigo-600 scale-110 shadow-lg shadow-indigo-300' : 'bg-indigo-100'
                }`}>
                  <Upload className={`w-10 h-10 transition-colors ${isDragging ? 'text-white' : 'text-indigo-500'}`} />
                </div>
                <div>
                  <p className="text-xl font-bold text-indigo-900">Drop your PDF here</p>
                  <p className="text-base text-indigo-400 mt-1">or click to browse files</p>
                </div>
                <span className="text-sm font-semibold text-indigo-400 bg-indigo-50 px-4 py-1.5 rounded-full border border-indigo-100">
                  PDF files only
                </span>
              </div>
            )}
          </div>

          {uploadError && (
            <div className="mt-5 flex items-center justify-center gap-2 text-red-500">
              <AlertCircle className="w-4 h-4" />
              <span className="text-base font-medium">{uploadError}</span>
            </div>
          )}
        </div>

        {/* How it works */}
        <div className="max-w-2xl mx-auto px-6 pb-16">
          <div className="grid grid-cols-3 gap-4">
            {[
              { icon: Upload, label: 'Upload', desc: 'PDF is chunked and embedded into a semantic vector index', color: 'bg-blue-100 text-blue-600' },
              { icon: MessageSquare, label: 'Ask', desc: 'Questions matched to chunks by meaning, not keywords', color: 'bg-indigo-100 text-indigo-600' },
              { icon: Zap, label: 'Verify', desc: 'Every answer shows a confidence score for full transparency', color: 'bg-violet-100 text-violet-600' },
            ].map((step, i) => (
              <div key={i}
                className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 border border-indigo-100 hover:shadow-xl hover:shadow-indigo-100 hover:scale-[1.03] hover:bg-white transition-all duration-200 cursor-default">
                <div className={`w-12 h-12 rounded-2xl ${step.color} flex items-center justify-center mb-4`}>
                  <step.icon className="w-6 h-6" />
                </div>
                <p className="text-base font-bold text-indigo-950 mb-1.5">{step.label}</p>
                <p className="text-sm text-indigo-400 leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Chat view
  return (
    <div className="min-h-screen flex flex-col" style={{
      background: 'linear-gradient(135deg, #EFF6FF 0%, #EEF2FF 50%, #F5F3FF 100%)',
      fontFamily: "'Plus Jakarta Sans', sans-serif"
    }}>
      <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />

      {/* Header */}
      <header className="px-8 py-4 flex items-center justify-between border-b border-indigo-100 bg-white/60 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-200">
            <MessageSquare className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold text-indigo-950">Document Intelligence</h1>
            <p className="text-xs text-indigo-400 font-semibold tracking-wide">POWERED BY RAG + GEMINI</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2.5 bg-white border border-indigo-200 rounded-2xl px-4 py-2.5 shadow-sm">
            <FileText className="w-4 h-4 text-indigo-500 shrink-0" />
            <span className="text-sm font-bold text-indigo-900 max-w-[180px] truncate">{doc.filename}</span>
            <span className="text-sm text-indigo-400 font-medium shrink-0">{doc.pageCount}p · {doc.chunkCount} chunks</span>
          </div>
          <button onClick={handleReset}
            className="flex items-center gap-2 text-sm font-semibold text-indigo-500 hover:text-indigo-700 px-4 py-2.5 rounded-2xl hover:bg-white/80 transition-all duration-200">
            <RotateCcw className="w-4 h-4" /> New document
          </button>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-8">
        <div className="max-w-2xl mx-auto">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center gap-6 pt-16">
              <div className="w-24 h-24 rounded-3xl bg-white border border-indigo-200 shadow-xl shadow-indigo-100 flex items-center justify-center">
                <MessageSquare className="w-12 h-12 text-indigo-500" />
              </div>
              <div>
                <h2 className="text-3xl font-extrabold text-indigo-950">Ready to answer</h2>
                <p className="text-lg text-indigo-400 font-medium mt-2">Ask anything about your document below</p>
              </div>
              <div className="flex flex-wrap gap-3 justify-center mt-2">
                {['What is the main topic?', 'Summarize the key points', 'What are the conclusions?'].map((s) => (
                  <button key={s} onClick={() => setInput(s)}
                    className="text-base font-semibold px-5 py-3 rounded-2xl bg-white border border-indigo-200 text-indigo-600 hover:bg-indigo-600 hover:text-white hover:border-indigo-600 hover:shadow-lg hover:shadow-indigo-200 hover:scale-[1.04] transition-all duration-200">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] rounded-3xl px-6 py-4 ${msg.role === 'user'
                    ? 'bg-indigo-600 shadow-lg shadow-indigo-200 rounded-tr-lg'
                    : 'bg-white border border-indigo-100 shadow-md shadow-indigo-50 rounded-tl-lg'}`}>
                    {msg.role === 'user' ? (
                      <p className="text-base leading-relaxed font-medium text-white">{msg.content}</p>
                    ) : (
                      <div className="text-base leading-relaxed font-medium text-indigo-950">
                        <ReactMarkdown
                          components={{
                            strong: ({children}) => <strong className="font-bold text-indigo-900">{children}</strong>,
                            ul: ({children}) => <ul className="list-disc list-inside mt-2 space-y-1">{children}</ul>,
                            li: ({children}) => <li className="text-indigo-800">{children}</li>,
                            p: ({children}) => <p className="mb-2 last:mb-0">{children}</p>,
                          }}
                        >
                          {msg.content}
                        </ReactMarkdown>
                      </div>
                    )}
                    {msg.role === 'assistant' && msg.similarityScore !== undefined && (
                      <div className="mt-3 pt-3 border-t border-indigo-100">
                        <ConfidenceBadge score={msg.similarityScore} isInScope={msg.isInScope ?? false} />
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {isAsking && (
                <div className="flex justify-start">
                  <div className="bg-white border border-indigo-100 rounded-3xl rounded-tl-lg px-6 py-4 shadow-md shadow-indigo-50">
                    <div className="flex items-center gap-2">
                      {[0, 150, 300].map((delay) => (
                        <span key={delay} className="w-2.5 h-2.5 rounded-full bg-indigo-400 animate-bounce"
                          style={{ animationDelay: `${delay}ms` }} />
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
      <div className="px-6 pb-8">
        <div className="max-w-2xl mx-auto">
          <div className="flex gap-3 bg-white rounded-3xl border border-indigo-200 shadow-xl shadow-indigo-100 p-2.5">
            <input
              type="text" value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
              placeholder="Ask a question about your document..."
              disabled={isAsking}
              className="flex-1 bg-transparent px-4 py-3 text-base text-indigo-950 placeholder-indigo-300 outline-none font-semibold"
            />
            <button onClick={handleSend} disabled={!input.trim() || isAsking}
              className="w-12 h-12 rounded-2xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-all duration-200 hover:shadow-lg hover:shadow-indigo-200 hover:scale-105 active:scale-95">
              {isAsking
                ? <Loader2 className="w-5 h-5 text-white animate-spin" />
                : <Send className="w-5 h-5 text-white" />
              }
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}