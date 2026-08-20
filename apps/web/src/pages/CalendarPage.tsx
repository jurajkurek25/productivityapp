import { useEffect, useState } from "react";
import type { TaskInstance } from "@productivityapp/core";
import { api } from "../lib/api";
import { addDaysISO, formatShort, todayISO } from "../lib/date";
import { DomainBadge, domainDotClass } from "../components/DomainBadge";

function startOfWeek(date: string): string {
  const dow = new Date(date + "T00:00:00Z").getUTCDay();
  return addDaysISO(date, -dow);
}

export function CalendarPage() {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(todayISO()));
  const [instances, setInstances] = useState<TaskInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const weekEnd = addDaysISO(weekStart, 6);
  const days = Array.from({ length: 7 }, (_, i) => addDaysISO(weekStart, i));

  function load() {
    setLoading(true);
    api
      .listCalendar(weekStart, weekEnd)
      .then(setInstances)
      .finally(() => setLoading(false));
  }

  useEffect(load, [weekStart]);

  async function handleGenerate() {
    setGenerating(true);
    setMessage(null);
    try {
      const res = await api.generateCalendar(weekStart, weekEnd);
      setMessage(
        `Placed ${res.placed.length} task(s). Today's energy score: ${res.energyState.score}/100 (capacity at ${Math.round(
          res.energyState.loadMultiplier * 100
        )}%).${res.unplaced.length ? ` ${res.unplaced.length} could not fit — consider lowering scope.` : ""}`
      );
      load();
    } finally {
      setGenerating(false);
    }
  }

  async function setStatus(id: string, status: TaskInstance["status"]) {
    setInstances((prev) => prev.map((i) => (i.id === id ? { ...i, status } : i)));
    await api.updateInstance(id, status);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Calendar</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setWeekStart(addDaysISO(weekStart, -7))}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
          >
            ← Prev
          </button>
          <button
            onClick={() => setWeekStart(startOfWeek(todayISO()))}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
          >
            Today
          </button>
          <button
            onClick={() => setWeekStart(addDaysISO(weekStart, 7))}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
          >
            Next →
          </button>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="ml-2 rounded-md bg-slate-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {generating ? "Generating…" : "Generate schedule"}
          </button>
        </div>
      </div>

      {message && <p className="rounded-md bg-slate-100 px-4 py-2 text-sm text-slate-700">{message}</p>}

      {loading ? (
        <p className="text-slate-400">Loading…</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-7">
          {days.map((date) => {
            const dayInstances = instances
              .filter((i) => i.scheduledDate === date)
              .sort((a, b) => a.title.localeCompare(b.title));
            const isToday = date === todayISO();
            return (
              <div
                key={date}
                className={`rounded-xl border bg-white p-3 ${isToday ? "border-slate-900" : "border-slate-200"}`}
              >
                <p className={`mb-2 text-xs font-medium ${isToday ? "text-slate-900" : "text-slate-400"}`}>
                  {formatShort(date)}
                </p>
                <div className="space-y-2">
                  {dayInstances.length === 0 && <p className="text-xs text-slate-300">—</p>}
                  {dayInstances.map((inst) => (
                    <div key={inst.id} className="rounded-md border border-slate-100 p-2">
                      <div className="flex items-center gap-1.5">
                        <span className={`h-1.5 w-1.5 rounded-full ${domainDotClass(inst.domain)}`} />
                        <p
                          className={`text-xs font-medium leading-snug ${
                            inst.status === "completed" ? "text-slate-300 line-through" : "text-slate-700"
                          }`}
                        >
                          {inst.title}
                        </p>
                      </div>
                      <p className="mt-0.5 text-[10px] text-slate-400">{inst.durationMinutes}m</p>
                      {inst.status !== "completed" && (
                        <div className="mt-1 flex gap-2">
                          <button
                            onClick={() => setStatus(inst.id, "completed")}
                            className="text-[10px] font-medium text-emerald-600 hover:underline"
                          >
                            Done
                          </button>
                          <button
                            onClick={() => setStatus(inst.id, "skipped")}
                            className="text-[10px] font-medium text-slate-400 hover:underline"
                          >
                            Skip
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex flex-wrap gap-4 pt-2">
        {(["study", "business", "social", "relax"] as const).map((d) => (
          <DomainBadge key={d} domain={d} />
        ))}
      </div>
    </div>
  );
}
