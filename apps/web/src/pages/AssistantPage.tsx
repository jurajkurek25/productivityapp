import { type KeyboardEvent, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Bot, CheckCircle2, Send, Trash2 } from "lucide-react";
import { api, type AiChatMessage } from "../lib/api";
import { Card } from "../components/Card";
import { Button } from "../components/Button";
import { t } from "../lib/i18n";

function ActionChips({ actions }: { actions: AiChatMessage["actions"] }) {
  if (actions.length === 0) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {actions.map((a, i) => (
        <Link
          key={`${a.type}-${a.stepId ?? a.goalId}-${i}`}
          to={`/goals/${a.goalId}`}
          className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100"
        >
          <CheckCircle2 size={12} strokeWidth={2.5} />
          {a.type === "create_goal" ? t.assistant.createdGoal(a.title) : t.assistant.createdStep(a.title)}
        </Link>
      ))}
    </div>
  );
}

export function AssistantPage() {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [messages, setMessages] = useState<AiChatMessage[] | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    Promise.all([api.getAiStatus(), api.getAiMessages()]).then(([status, msgs]) => {
      setConfigured(status.configured);
      setMessages(msgs);
    });
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  async function send() {
    const text = input.trim();
    if (!text || sending) return;
    setError(null);
    setInput("");
    setSending(true);
    setMessages((prev) => [
      ...(prev ?? []),
      { id: `local-${Date.now()}`, role: "user", content: text, actions: [], createdAt: new Date().toISOString() },
    ]);
    try {
      const reply = await api.sendAiMessage(text);
      setMessages((prev) => [...(prev ?? []), reply]);
    } catch {
      setError(t.assistant.errorSending);
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  async function clearHistory() {
    if (!confirm(t.assistant.confirmClear)) return;
    await api.clearAiMessages();
    setMessages([]);
  }

  return (
    <div className="flex h-full flex-col space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">{t.assistant.title}</h1>
          <p className="mt-1 max-w-xl text-sm text-slate-500">{t.assistant.subtitle}</p>
        </div>
        {messages && messages.length > 0 && (
          <button
            onClick={clearHistory}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <Trash2 size={14} strokeWidth={2.25} />
            {t.assistant.clearHistory}
          </button>
        )}
      </div>

      {configured === false ? (
        <Card className="flex flex-col items-center py-14 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-600">
            <Bot size={22} strokeWidth={2} />
          </div>
          <p className="text-sm font-medium text-slate-700">{t.assistant.notConfiguredTitle}</p>
          <p className="mt-1 max-w-sm text-sm text-slate-400">{t.assistant.notConfiguredBody}</p>
        </Card>
      ) : (
        <>
          <Card className="flex min-h-[50vh] flex-1 flex-col overflow-y-auto">
            {messages === null ? (
              <div className="space-y-3">
                {[0, 1].map((i) => (
                  <div key={i} className="h-14 animate-pulse rounded-lg bg-slate-100" />
                ))}
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center py-10 text-center">
                <Bot size={28} strokeWidth={1.75} className="mb-2 text-brand-300" />
                <p className="max-w-xs text-sm text-slate-400">{t.assistant.emptyState}</p>
              </div>
            ) : (
              <div className="flex flex-1 flex-col gap-3">
                {messages.map((m) => (
                  <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                        m.role === "user" ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-800"
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{m.content}</p>
                      {m.role === "assistant" && <ActionChips actions={m.actions} />}
                    </div>
                  </div>
                ))}
                {sending && (
                  <div className="flex justify-start">
                    <div className="rounded-2xl bg-slate-100 px-4 py-2.5 text-sm text-slate-400">…</div>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>
            )}
          </Card>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex items-end gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t.assistant.placeholder}
              rows={2}
              disabled={sending}
              className="w-full flex-1 resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
            <Button variant="primary" icon={Send} onClick={send} disabled={sending || !input.trim()}>
              {sending ? t.assistant.sending : t.assistant.send}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
