import { FormEvent, useEffect, useState } from "react";
import { CheckCircle2, ChevronLeft, ChevronRight, Circle, Pencil, Sparkles } from "lucide-react";
import type { TaskInstance } from "@productivityapp/core";
import { api } from "../lib/api";
import { addDaysISO, formatShort, todayISO } from "../lib/date";
import { DomainBadge, domainDotClass } from "../components/DomainBadge";
import { Button } from "../components/Button";

const fieldClass = "rounded border border-slate-300 px-1.5 py-1 text-xs focus:border-brand-500 focus:outline-none";

function startOfWeek(date: string): string {
  const dow = new Date(date + "T00:00:00Z").getUTCDay();
  return addDaysISO(date, -dow);
}

interface InstanceFormState {
  title: string;
  durationMinutes: number;
  scheduledDate: string;
}

export function CalendarPage() {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(todayISO()));
  const [instances, setInstances] = useState<TaskInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<InstanceFormState | null>(null);

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
    await api.updateInstance(id, { status });
  }

  function startEdit(inst: TaskInstance) {
    setEditingId(inst.id);
    setEditForm({ title: inst.title, durationMinutes: inst.durationMinutes, scheduledDate: inst.scheduledDate });
  }

  async function handleEditSubmit(e: FormEvent) {
    e.preventDefault();
    if (!editingId || !editForm || !editForm.title.trim()) return;
    await api.updateInstance(editingId, {
      title: editForm.title.trim(),
      durationMinutes: editForm.durationMinutes,
      scheduledDate: editForm.scheduledDate,
    });
    setEditingId(null);
    load();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">Calendar</h1>
          <p className="mt-1 text-sm text-slate-500">
            {formatShort(weekStart)} – {formatShort(weekEnd)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center overflow-hidden rounded-lg border border-slate-300">
            <button
              onClick={() => setWeekStart(addDaysISO(weekStart, -7))}
              className="p-2 text-slate-500 hover:bg-slate-50"
              title="Previous week"
            >
              <ChevronLeft size={16} strokeWidth={2.25} />
            </button>
            <button
              onClick={() => setWeekStart(startOfWeek(todayISO()))}
              className="border-x border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              Today
            </button>
            <button
              onClick={() => setWeekStart(addDaysISO(weekStart, 7))}
              className="p-2 text-slate-500 hover:bg-slate-50"
              title="Next week"
            >
              <ChevronRight size={16} strokeWidth={2.25} />
            </button>
          </div>
          <Button variant="primary" icon={Sparkles} onClick={handleGenerate} disabled={generating}>
            {generating ? "Generating…" : "Generate schedule"}
          </Button>
        </div>
      </div>

      {message && <p className="rounded-lg bg-brand-50 px-4 py-2.5 text-sm text-brand-800">{message}</p>}

      {loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-7">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="h-40 animate-pulse rounded-xl border border-slate-200/80 bg-white" />
          ))}
        </div>
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
                className={`rounded-xl border bg-white p-3 shadow-card ${
                  isToday ? "border-brand-300 ring-1 ring-brand-100" : "border-slate-200/80"
                }`}
              >
                <p className={`mb-2 text-xs font-semibold ${isToday ? "text-brand-700" : "text-slate-400"}`}>
                  {formatShort(date)}
                </p>
                <div className="space-y-2">
                  {dayInstances.length === 0 && <p className="text-xs text-slate-300">—</p>}
                  {dayInstances.map((inst) =>
                    editingId === inst.id && editForm ? (
                      <form
                        key={inst.id}
                        onSubmit={handleEditSubmit}
                        className="space-y-1.5 rounded-lg border border-brand-300 bg-brand-50/40 p-2"
                      >
                        <input
                          value={editForm.title}
                          onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                          className={`${fieldClass} w-full`}
                          required
                        />
                        <div className="flex gap-1">
                          <input
                            type="date"
                            value={editForm.scheduledDate}
                            onChange={(e) => setEditForm({ ...editForm, scheduledDate: e.target.value })}
                            className={`${fieldClass} flex-1 text-[10px]`}
                          />
                          <input
                            type="number"
                            min={5}
                            value={editForm.durationMinutes}
                            onChange={(e) => setEditForm({ ...editForm, durationMinutes: Number(e.target.value) })}
                            className={`${fieldClass} w-14 text-[10px]`}
                            title="Minutes"
                          />
                        </div>
                        <div className="flex gap-2 pt-0.5">
                          <button type="submit" className="text-[11px] font-semibold text-brand-600 hover:text-brand-700">
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className="text-[11px] font-medium text-slate-400 hover:text-slate-600"
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    ) : (
                      <div key={inst.id} className="rounded-lg border border-slate-100 p-2">
                        <div className="flex items-start gap-1.5">
                          <span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${domainDotClass(inst.domain)}`} />
                          <p
                            className={`text-xs font-medium leading-snug ${
                              inst.status === "completed" ? "text-slate-300 line-through" : "text-slate-700"
                            }`}
                          >
                            {inst.title}
                          </p>
                        </div>
                        <p className="ml-3 mt-0.5 text-[10px] text-slate-400">{inst.durationMinutes}m</p>
                        <div className="ml-3 mt-1.5 flex items-center gap-2.5">
                          {inst.status !== "completed" && (
                            <>
                              <button
                                onClick={() => setStatus(inst.id, "completed")}
                                className="flex items-center gap-1 text-[11px] font-medium text-emerald-600 hover:text-emerald-700"
                                title="Mark done"
                              >
                                <CheckCircle2 size={12} strokeWidth={2.5} />
                                Done
                              </button>
                              <button
                                onClick={() => setStatus(inst.id, "skipped")}
                                className="flex items-center gap-1 text-[11px] font-medium text-slate-400 hover:text-slate-600"
                                title="Skip"
                              >
                                <Circle size={12} strokeWidth={2.5} />
                                Skip
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => startEdit(inst)}
                            className="flex items-center gap-1 text-[11px] font-medium text-slate-400 hover:text-slate-600"
                            title="Edit"
                          >
                            <Pencil size={11} strokeWidth={2.5} />
                            Edit
                          </button>
                        </div>
                      </div>
                    )
                  )}
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
