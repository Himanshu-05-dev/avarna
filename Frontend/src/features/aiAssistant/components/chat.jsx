import { useState, useRef, useEffect } from "react";
import {
  Send,
  Paperclip,
  Image as ImageIcon,
  Database,
  Bot,
  User,
  CheckCircle2,
  RefreshCw,
  Loader2,
  AlertCircle,
  X,
} from "lucide-react";
import { Button } from "../../../components/common/button";
import { useChat } from "../hooks/useChat";
import { useGetMe } from "../../auth/hooks/useAuth";

// ─── Source icon by type ───────────────────────────────────────────────────────
function SourceIcon({ type, color }) {
  const colorMap = {
    rose: "bg-rose-50 text-rose-500",
    blue: "bg-blue-50 text-blue-500",
    indigo: "bg-indigo-50 text-indigo-500",
  };
  const cls = colorMap[color] ?? "bg-slate-100 text-slate-500";

  if (type === "pdf") {
    return (
      <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${cls}`}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
          <polyline points="14 2 14 8 20 8"/>
          <path d="M10 18v-6"/><path d="M8 12h4"/><path d="M10 12v6"/><path d="M10 18H8"/>
        </svg>
      </div>
    );
  }
  if (type === "doc") {
    return (
      <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${cls}`}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="16" y1="13" x2="8" y2="13"/>
          <line x1="16" y1="17" x2="8" y2="17"/>
          <polyline points="10 9 9 9 8 9"/>
        </svg>
      </div>
    );
  }
  return (
    <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${cls}`}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
        <line x1="9" y1="3" x2="9" y2="21"/>
        <line x1="15" y1="3" x2="15" y2="21"/>
      </svg>
    </div>
  );
}

// ─── Render AI message content with bold, numbered lists & ref badges ─────────
function MessageContent({ content, references = [] }) {
  if (!content) return null;

  // Split by numbered list items
  const lines = content.split("\n");

  return (
    <div className="space-y-3 text-[14px] leading-relaxed text-slate-700">
      {lines.map((line, i) => {
        if (!line.trim()) return null;

        // Numbered list item: starts with "1." "2." etc.
        const listMatch = line.match(/^(\d+)\.\s+(.+)/);
        if (listMatch) {
          const text = renderInlineMarkdown(listMatch[2], references);
          return (
            <div key={i} className="flex gap-3">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-100 text-[11px] font-bold text-blue-700">
                {listMatch[1]}
              </span>
              <p>{text}</p>
            </div>
          );
        }

        return <p key={i}>{renderInlineMarkdown(line, references)}</p>;
      })}
    </div>
  );
}

function renderInlineMarkdown(text, references = []) {
  // Handle **bold** and [Ref XX] references
  const parts = text.split(/(\*\*[^*]+\*\*|\[Ref \d+\])/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold text-slate-900">
          {part.slice(2, -2)}
        </strong>
      );
    }
    const refMatch = part.match(/^\[Ref (\d+)\]$/);
    if (refMatch) {
      const ref = references[parseInt(refMatch[1]) - 1];
      return (
        <span
          key={i}
          title={ref ? `${ref.source} — ${ref.line}` : ""}
          className="mx-1 inline-flex cursor-pointer items-center rounded bg-blue-50 px-1.5 py-0.5 text-[12px] font-bold text-blue-700 hover:bg-blue-100 transition-colors"
        >
          {part}
        </span>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

// ─── Individual message bubble ─────────────────────────────────────────────────
function MessageBubble({ message, userName }) {
  const isUser = message.role === "user";

  if (isUser) {
    return (
      <div className="flex gap-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
          <User className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-bold text-slate-900">
              {message.sender || userName || "You"}
            </span>
            <span className="text-[11px] text-slate-400">{message.timestamp}</span>
          </div>
          <div className="mt-2 rounded-2xl rounded-tl-sm border border-slate-100 bg-slate-50 p-4 text-[14.5px] leading-relaxed text-slate-700 shadow-sm">
            {message.content}
          </div>
        </div>
      </div>
    );
  }

  // AI message
  return (
    <div className="flex gap-4">
      <div className="flex-1 flex flex-col items-end">
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-slate-400">{message.timestamp}</span>
          <span className="text-[13px] font-bold text-blue-700">Aegis AI</span>
        </div>
        <div className="mt-2 w-full rounded-2xl rounded-tr-sm border border-blue-100 bg-white p-5 shadow-sm">
          <MessageContent content={message.content} references={message.references} />

          {/* Source citation tags */}
          {message.citations?.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
              {message.citations.map((cite, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-[12px] font-medium text-slate-600"
                >
                  {idx === 0 ? (
                    <Database className="h-3.5 w-3.5 text-slate-400" />
                  ) : (
                    <CheckCircle2 className="h-3.5 w-3.5 text-slate-400" />
                  )}
                  {cite}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
        <Bot className="h-5 w-5" />
      </div>
    </div>
  );
}

// ─── Typing indicator ──────────────────────────────────────────────────────────
function TypingIndicator() {
  return (
    <div className="flex gap-4">
      <div className="flex-1 flex flex-col items-end">
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-slate-400">Just now</span>
          <span className="text-[13px] font-bold text-blue-700">Aegis AI</span>
        </div>
        <div className="mt-2 flex items-center gap-2 rounded-2xl rounded-tr-sm border border-blue-100 bg-white px-5 py-4 shadow-sm">
          <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
          <span className="text-[13px] text-slate-500">Analyzing documents…</span>
        </div>
      </div>
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
        <Bot className="h-5 w-5" />
      </div>
    </div>
  );
}

// ─── Main Chat Component ───────────────────────────────────────────────────────
export default function AuditAssistantChat() {
  const [input, setInput] = useState("");
  const {
    messages,
    isLoading,
    error,
    knowledgeSources,
    liveCitations,
    sendMessage,
    dismissError,
  } = useChat();
  const { user } = useGetMe();
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Auto-scroll to newest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;
    setInput("");
    await sendMessage(trimmed);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex h-full gap-6">
      {/* ── Main Chat Area ──────────────────────────────────────── */}
      <div className="flex flex-1 flex-col rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8">

          {/* Welcome banner — shown only when empty */}
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center space-y-4 py-12">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-blue-50 text-blue-600 shadow-sm">
                <Bot className="h-6 w-6" />
              </div>
              <div className="text-center">
                <h3 className="text-lg font-semibold text-slate-900">
                  How can I assist your audit today?
                </h3>
                <p className="mt-2 max-w-md text-[14.5px] leading-relaxed text-slate-500">
                  I can analyze compliance documents, verify SOC2 controls, or
                  cross-reference internal policies against ISO 27001 standards.
                </p>
              </div>
            </div>
          )}

          {/* Welcome banner — shown above existing messages */}
          {messages.length > 0 && messages[0]?.role !== "welcome" && (
            <div className="flex flex-col items-center space-y-3 py-4">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-blue-600">
                <Bot className="h-5 w-5" />
              </div>
              <div className="text-center">
                <p className="text-[15px] font-semibold text-slate-800">
                  How can I assist your audit today?
                </p>
                <p className="mt-1 text-[13px] leading-relaxed text-slate-500">
                  I can analyze compliance documents, verify SOC2 controls, or
                  cross-reference internal policies against ISO 27001 standards.
                </p>
              </div>
            </div>
          )}

          {/* Message list */}
          {messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              userName={user?.username}
            />
          ))}

          {/* Typing indicator */}
          {isLoading && <TypingIndicator />}

          {/* Error banner */}
          {error && (
            <div className="flex items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] text-rose-700">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span className="flex-1">{error}</span>
              <button onClick={dismissError} className="shrink-0 hover:text-rose-900 transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* ── Input Area ──────────────────────────────────────────── */}
        <div className="border-t border-slate-100 p-6">
          <div className="relative flex items-center rounded-2xl border border-slate-200 bg-slate-50/50 p-2 shadow-sm focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 transition-all">
            {/* Toolbar */}
            <div className="flex items-center gap-1 px-2 text-slate-400">
              <button className="grid h-8 w-8 place-items-center rounded-lg hover:bg-slate-200 hover:text-slate-600 transition-colors">
                <Paperclip className="h-4 w-4" />
              </button>
              <button className="grid h-8 w-8 place-items-center rounded-lg hover:bg-slate-200 hover:text-slate-600 transition-colors">
                <ImageIcon className="h-4 w-4" />
              </button>
              <div className="mx-1 h-4 w-px bg-slate-300" />
              <div className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-semibold tracking-wider text-slate-500">
                <Database className="h-3.5 w-3.5" />
                INTERNAL RAG
              </div>
            </div>

            {/* Text input */}
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask the assistant about compliance..."
              disabled={isLoading}
              className="flex-1 bg-transparent px-3 py-2 text-[14.5px] outline-none placeholder:text-slate-400 text-slate-700 disabled:opacity-60"
            />

            {/* Send button */}
            <Button
              onClick={handleSend}
              disabled={isLoading || !input.trim()}
              className="h-10 w-10 shrink-0 rounded-xl bg-blue-600 p-0 text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
          <p className="mt-3 text-center text-[11px] text-slate-400">
            Aegis AI can make mistakes. Verify critical audit data against original source documents.
          </p>
        </div>
      </div>

      {/* ── Right Sidebar — Knowledge Base ──────────────────────── */}
      <div className="flex w-[340px] flex-col gap-6">
        {/* Header */}
        <div>
          <h2 className="text-[17px] font-bold text-slate-900">Knowledge Base</h2>
          <p className="mt-1 text-[13px] text-slate-500">
            Currently indexed documents for this session
          </p>
        </div>

        {/* Active Sources */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Active Sources
            </h3>
            <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
              {knowledgeSources.length} Total
            </span>
          </div>

          <div className="flex flex-col gap-3">
            {knowledgeSources.map((src) => (
              <div
                key={src.id}
                className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm hover:shadow-md transition-shadow"
              >
                <SourceIcon type={src.icon} color={src.color} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold text-slate-900">
                    {src.name}
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    Modified: {src.modified}
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    {src.status === "synced" ? (
                      <>
                        <span className="inline-flex rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-600">
                          Synced
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {src.chunks} Chunks
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-600">
                          <RefreshCw className="h-2.5 w-2.5 animate-spin" />
                          Indexing
                        </span>
                        <span className="text-[11px] text-slate-400">Real-time</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Live Citation Stream */}
        <div className="mt-auto rounded-xl bg-slate-900 p-5 shadow-sm">
          <h3 className="mb-4 text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Live Citation Stream
          </h3>

          <div className="space-y-4">
            {liveCitations.map((cite) => (
              <div key={cite.id} className="border-l-2 border-slate-600 pl-3">
                <p className="mb-1 font-mono text-[11px] text-slate-500">
                  Source: {cite.source}
                </p>
                <p className="text-[12.5px] italic text-slate-300">{cite.text}</p>
              </div>
            ))}
          </div>

          <Button className="mt-5 h-9 w-full border-none bg-slate-800 text-[12px] text-slate-300 shadow-none hover:bg-slate-700">
            View All Evidence
          </Button>
        </div>
      </div>
    </div>
  );
}
