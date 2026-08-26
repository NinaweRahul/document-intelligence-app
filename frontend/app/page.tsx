'use client';

import { useState, useRef, useEffect } from 'react';
import { Upload, Send, FileText, RotateCcw, Loader2, MessageSquare, AlertCircle } from 'lucide-react';

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
      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20">
        <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
        Out of scope
      </span>
    );
  }
  const level = score >= 0.65 ? 'high' : score >= 0.45 ? 'medium' : 'low';
  const config = {
    high:   { label: 'High confidence',   color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', dot: 'bg-emerald-400' },
    medium: { label: 'Medium confidence', color: 'text-amber-400',   bg: 'bg-amber-500/10',   border: 'border-amber-500/20',   dot: 'bg-amber-400'   },
    low:    { label: 'Low confidence',    color: 'text-red-400',     bg: 'bg-red-500/10',     border: 'border-red-500/20',     dot: 'bg-red-400'     },
  }[level];
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${config.bg} ${config.color} border ${config.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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

  const suggestions = doc
    ? ['What is the main topic?', 'Summarize the key points', 'What are the conclusions?']
    : ['Summarize the key findings', 'What are the main recommendations?', 'What data was collected?'];

  return (
    <div className="min-h-screen bg-[#0F1117] text-[#E8E8F0] flex flex-col">
      {/* Header */}
      <header className="border-b border-[#2D3147] px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
            <MessageSquare className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-white">Document Intelligence</h1>
            <p className="text-xs text-[#8B8BA7]">Powered by RAG + Gemini</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <a href="https://github.com/NinaweRahul/document-intelligence-app" target="_blank" rel="noopener noreferrer"
            className="text-xs text-[#8B8BA7] hover:text-white transition-colors">GitHub</a>
          {doc && (
            <button onClick={handleReset} className="flex items-center gap-1.5 text-xs text-[#8B8BA7] hover:text-white transition-colors">
              <RotateCcw className="w-3 h-3" /> New document
            </button>
          )}
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel */}
        <div className="w-72 border-r border-[#2D3147] flex flex-col p-5 gap-6">
          {!doc ? (
            <div>
              <p className="text-xs font-medium text-[#8B8BA7] uppercase tracking-wider mb-3">Upload Document</p>
              <div
                className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${isUploading ? 'border-indigo-500 bg-indigo-500/5' : 'border-[#2D3147] hover:border-indigo-500/50 hover:bg-[#1A1D27]'}`}
                onClick={() => !isUploading && fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleUpload(f); }}
              >
                <input ref={fileInputRef} type="file" accept=".pdf" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); }} />
                {isUploading ? (
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
                    <p className="text-xs text-[#8B8BA7]">Indexing document...</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <Upload className="w-8 h-8 text-[#8B8BA7]" />
                    <p className="text-xs text-[#8B8BA7]">Drop a PDF or click to upload</p>
                  </div>
                )}
              </div>
              {uploadError && (
                <div className="mt-3 flex items-start gap-2 text-xs text-red-400">
                  <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />{uploadError}
                </div>
              )}
            </div>
          ) : (
            <div>
              <p className="text-xs font-medium text-[#8B8BA7] uppercase tracking-wider mb-3">Document</p>
              <div className="bg-[#1A1D27] rounded-xl p-4 border border-[#2D3147]">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center shrink-0">
                    <FileText className="w-4 h-4 text-indigo-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-white truncate">{doc.filename}</p>
                    <p className="text-xs text-[#8B8BA7] mt-0.5">{doc.pageCount} pages · {doc.chunkCount} chunks</p>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-[#2D3147] flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span className="text-xs text-emerald-400">Ready to answer questions</span>
                </div>
              </div>
            </div>
          )}

          {/* How it works */}
          <div>
            <p className="text-xs font-medium text-[#8B8BA7] uppercase tracking-wider mb-3">How it works</p>
            <div className="space-y-3">
              {[
                { label: 'Upload', desc: 'PDF is chunked and embedded into a vector index' },
                { label: 'Ask', desc: 'Questions matched against chunks by semantic meaning' },
                { label: 'Verify', desc: 'Confidence score shows how grounded each answer is' },
              ].map((step, i) => (
                <div key={i} className="flex gap-3">
                  <span className="w-5 h-5 rounded-full bg-[#1A1D27] border border-[#2D3147] text-[10px] text-[#8B8BA7] flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                  <div>
                    <p className="text-xs font-medium text-white">{step.label}</p>
                    <p className="text-xs text-[#8B8BA7] leading-relaxed">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Panel */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center">
                  <FileText className="w-7 h-7 text-indigo-400" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">
                    {doc ? 'Document indexed' : 'Ask anything about your document'}
                  </h2>
                  <p className="text-sm text-[#8B8BA7] mt-1">
                    {doc ? 'Ask a question to get started' : 'Upload a PDF on the left to begin'}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 justify-center mt-1">
                  {suggestions.map((s) => (
                    <button key={s} onClick={() => doc && setInput(s)}
                      className={`text-xs px-3 py-1.5 rounded-full bg-[#1A1D27] border border-[#2D3147] text-[#8B8BA7] transition-all ${doc ? 'hover:text-white hover:border-indigo-500/50 cursor-pointer' : 'opacity-40 cursor-default'}`}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] ${msg.role === 'user'
                    ? 'bg-indigo-600 text-white rounded-2xl rounded-tr-sm px-4 py-2.5'
                    : 'bg-[#1A1D27] border border-[#2D3147] rounded-2xl rounded-tl-sm px-4 py-3'}`}>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                    {msg.role === 'assistant' && msg.similarityScore !== undefined && (
                      <div className="mt-2 pt-2 border-t border-[#2D3147]">
                        <ConfidenceBadge score={msg.similarityScore} isInScope={msg.isInScope ?? false} />
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
            {isAsking && (
              <div className="flex justify-start">
                <div className="bg-[#1A1D27] border border-[#2D3147] rounded-2xl rounded-tl-sm px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    {[0, 150, 300].map((delay) => (
                      <span key={delay} className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: `${delay}ms` }} />
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="border-t border-[#2D3147] p-4">
            <div className="flex gap-3">
              <input
                type="text" value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                placeholder={doc ? 'Ask a question about your document...' : 'Upload a document to start asking questions'}
                disabled={!doc || isAsking}
                className="flex-1 bg-[#1A1D27] border border-[#2D3147] rounded-xl px-4 py-2.5 text-sm text-white placeholder-[#8B8BA7] outline-none focus:border-indigo-500/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <button onClick={handleSend} disabled={!doc || !input.trim() || isAsking}
                className="w-10 h-10 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition-colors shrink-0">
                {isAsking ? <Loader2 className="w-4 h-4 text-white animate-spin" /> : <Send className="w-4 h-4 text-white" />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}