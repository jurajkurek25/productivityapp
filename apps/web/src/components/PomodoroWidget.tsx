import { CheckCircle2, Pause, Play, Square } from "lucide-react";
import { usePomodoro } from "../context/PomodoroContext";
import { api } from "../lib/api";
import { t } from "../lib/i18n";

function formatTime(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function PomodoroWidget() {
  const { session, remainingMs, pause, resume, stop } = usePomodoro();
  if (!session) return null;

  const running = session.endsAt !== null;
  const isWork = session.phase === "work";

  async function markDone() {
    await api.updateInstance(session!.taskId, { status: "completed" }).catch(() => {});
    stop();
  }

  return (
    <div className="fixed bottom-20 right-4 z-30 w-72 max-w-[calc(100vw-2rem)] rounded-xl border border-slate-200/80 bg-white p-4 shadow-lg md:bottom-4">
      <div className="flex items-center justify-between">
        <span
          className={`text-xs font-semibold uppercase tracking-wide ${isWork ? "text-brand-600" : "text-emerald-600"}`}
        >
          {isWork ? t.pomodoro.workPhase : t.pomodoro.breakPhase}
        </span>
        <span className="font-display text-2xl font-bold tabular-nums text-slate-900">{formatTime(remainingMs)}</span>
      </div>
      <p className="mt-1 truncate text-sm text-slate-600">{session.taskTitle}</p>
      <div className="mt-3 flex items-center gap-2">
        {running ? (
          <button
            onClick={pause}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            <Pause size={13} strokeWidth={2.5} />
            {t.pomodoro.pause}
          </button>
        ) : (
          <button
            onClick={resume}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            <Play size={13} strokeWidth={2.5} />
            {t.pomodoro.resume}
          </button>
        )}
        <button
          onClick={stop}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          <Square size={13} strokeWidth={2.5} />
          {t.pomodoro.stop}
        </button>
        <button
          onClick={markDone}
          title={t.pomodoro.markDone}
          aria-label={t.pomodoro.markDone}
          className="ml-auto rounded-lg p-1.5 text-emerald-600 hover:bg-emerald-50"
        >
          <CheckCircle2 size={18} strokeWidth={2.25} />
        </button>
      </div>
    </div>
  );
}
