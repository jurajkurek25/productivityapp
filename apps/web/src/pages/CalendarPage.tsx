import { FormEvent, useEffect, useState } from "react";
import { CalendarRange, CheckCircle2, ChevronLeft, ChevronRight, Circle, Columns3, Pencil, Play, Plus, Sparkles } from "lucide-react";
import { LIFE_DOMAINS, type LifeDomain, type TaskInstance } from "@productivityapp/core";
import { api } from "../lib/api";
import { addDaysISO, formatShort, todayISO } from "../lib/date";
import { DomainBadge, domainDotClass } from "../components/DomainBadge";
import { Button } from "../components/Button";
import { usePomodoro } from "../context/PomodoroContext";
import { domainLabels, t } from "../lib/i18n";

const fieldClass = "rounded border border-slate-300 px-1.5 py-1 text-xs focus:border-brand-500 focus:outline-none";

function startOfWeek(date: string): string {
  const dow = new Date(date + "T00:00:00Z").getUTCDay();
  return addDaysISO(date, -dow);
}

function endOfWeek(date: string): string {
  const dow = new Date(date + "T00:00:00Z").getUTCDay();
  return addDaysISO(date, 6 - dow);
}

function startOfMonth(date: string): string {
  return date.slice(0, 7) + "-01";
}

function endOfMonth(date: string): string {
  const [y, m] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}

function addMonthsISO(date: string, n: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + n, d)).toISOString().slice(0, 10);
}

function diffDays(a: string, b: string): number {
  return Math.round((new Date(b + "T00:00:00Z").getTime() - new Date(a + "T00:00:00Z").getTime()) / 86_400_000);
}

function monthLabel(date: string): string {
  const label = new Date(date + "T00:00:00Z").toLocaleDateString("sk-SK", { month: "long", year: "numeric" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

interface InstanceFormState {
  title: string;
  durationMinutes: number;
  scheduledDate: string;
}

interface QuickAddFormState {
  title: string;
  domain: LifeDomain;
  durationMinutes: number;
}

const EMPTY_QUICK_ADD: QuickAddFormState = { title: "", domain: "business", durationMinutes: 30 };

export function CalendarPage() {
  const { start: startPomodoro } = usePomodoro();
  const [viewMode, setViewMode] = useState<"week" | "month">("week");
  const [weekStart, setWeekStart] = useState(() => startOfWeek(todayISO()));
  const [monthAnchor, setMonthAnchor] = useState(() => startOfMonth(todayISO()));
  const [instances, setInstances] = useState<TaskInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<InstanceFormState | null>(null);
  const [quickAddDate, setQuickAddDate] = useState<string | null>(null);
  const [quickAddForm, setQuickAddForm] = useState<QuickAddFormState>(EMPTY_QUICK_ADD);

  const weekEnd = addDaysISO(weekStart, 6);
  const days = Array.from({ length: 7 }, (_, i) => addDaysISO(weekStart, i));

  const monthGridStart = startOfWeek(monthAnchor);
  const monthGridEnd = endOfWeek(endOfMonth(monthAnchor));
  const monthDays = Array.from({ length: diffDays(monthGridStart, monthGridEnd) + 1 }, (_, i) =>
    addDaysISO(monthGridStart, i)
  );

  const rangeStart = viewMode === "week" ? weekStart : monthGridStart;
  const rangeEnd = viewMode === "week" ? weekEnd : monthGridEnd;

  function load() {
    setLoading(true);
    api
      .listCalendar(rangeStart, rangeEnd)
      .then(setInstances)
      .finally(() => setLoading(false));
  }

  useEffect(load, [viewMode, weekStart, monthAnchor]);

  function goToday() {
    setWeekStart(startOfWeek(todayISO()));
    setMonthAnchor(startOfMonth(todayISO()));
  }

  function goPrev() {
    if (viewMode === "week") setWeekStart(addDaysISO(weekStart, -7));
    else setMonthAnchor(addMonthsISO(monthAnchor, -1));
  }

  function goNext() {
    if (viewMode === "week") setWeekStart(addDaysISO(weekStart, 7));
    else setMonthAnchor(addMonthsISO(monthAnchor, 1));
  }

  function drillIntoWeek(date: string) {
    setWeekStart(startOfWeek(date));
    setViewMode("week");
  }

  async function handleGenerate() {
    setGenerating(true);
    setMessage(null);
    try {
      const res = await api.generateCalendar(rangeStart, rangeEnd);
      setMessage(
        t.calendar.placedMessage(
          res.placed.length,
          res.energyState.score,
          Math.round(res.energyState.loadMultiplier * 100),
          res.unplaced.length
        )
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

  function startQuickAdd(date: string) {
    setQuickAddDate(date);
    setQuickAddForm(EMPTY_QUICK_ADD);
  }

  async function submitQuickAdd(e: FormEvent) {
    e.preventDefault();
    if (!quickAddDate || !quickAddForm.title.trim()) return;
    await api.quickAddTask({
      title: quickAddForm.title.trim(),
      domain: quickAddForm.domain,
      scheduledDate: quickAddDate,
      durationMinutes: quickAddForm.durationMinutes,
    });
    setQuickAddDate(null);
    load();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">{t.calendar.title}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {viewMode === "week" ? `${formatShort(weekStart)} – ${formatShort(weekEnd)}` : monthLabel(monthAnchor)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center overflow-hidden rounded-lg border border-slate-300">
            <button
              onClick={() => setViewMode("week")}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium ${
                viewMode === "week" ? "bg-brand-50 text-brand-700" : "text-slate-500 hover:bg-slate-50"
              }`}
            >
              <Columns3 size={14} strokeWidth={2.25} />
              {t.calendar.weekView}
            </button>
            <button
              onClick={() => setViewMode("month")}
              className={`flex items-center gap-1.5 border-l border-slate-300 px-3 py-2 text-sm font-medium ${
                viewMode === "month" ? "bg-brand-50 text-brand-700" : "text-slate-500 hover:bg-slate-50"
              }`}
            >
              <CalendarRange size={14} strokeWidth={2.25} />
              {t.calendar.monthView}
            </button>
          </div>
          <div className="flex items-center overflow-hidden rounded-lg border border-slate-300">
            <button onClick={goPrev} className="p-2 text-slate-500 hover:bg-slate-50" title={t.calendar.prevPeriod}>
              <ChevronLeft size={16} strokeWidth={2.25} />
            </button>
            <button
              onClick={goToday}
              className="border-x border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              {t.calendar.today}
            </button>
            <button onClick={goNext} className="p-2 text-slate-500 hover:bg-slate-50" title={t.calendar.nextPeriod}>
              <ChevronRight size={16} strokeWidth={2.25} />
            </button>
          </div>
          <Button variant="primary" icon={Sparkles} onClick={handleGenerate} disabled={generating}>
            {generating ? t.calendar.generating : t.calendar.generateSchedule}
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
      ) : viewMode === "month" ? (
        <div>
          <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg bg-slate-200/80 text-center text-[10px] font-semibold text-slate-400">
            {t.settings.dayNames.map((name) => (
              <div key={name} className="bg-slate-50 py-1.5">
                {name.slice(0, 2)}
              </div>
            ))}
          </div>
          <div className="mt-1.5 grid grid-cols-7 gap-1.5">
            {monthDays.map((date) => {
              const dayInstances = instances.filter((i) => i.scheduledDate === date);
              const isToday = date === todayISO();
              const isCurrentMonth = date.slice(0, 7) === monthAnchor.slice(0, 7);
              const domainsPresent = [...new Set(dayInstances.map((i) => i.domain))];
              const dayNum = Number(date.slice(8, 10));
              return (
                <button
                  key={date}
                  onClick={() => drillIntoWeek(date)}
                  aria-label={`${formatShort(date)}${dayInstances.length ? `, ${t.calendar.taskCount(dayInstances.length)}` : ""}`}
                  className={`flex min-h-[60px] flex-col items-start gap-1 rounded-lg border p-1.5 text-left transition-colors sm:min-h-[80px] ${
                    isCurrentMonth ? "bg-white hover:bg-slate-50" : "bg-slate-50/70 hover:bg-slate-50"
                  } ${isToday ? "border-brand-300 ring-1 ring-brand-100" : "border-slate-200/80"}`}
                >
                  <span
                    className={`text-xs font-semibold ${
                      isToday ? "text-brand-700" : isCurrentMonth ? "text-slate-600" : "text-slate-300"
                    }`}
                  >
                    {dayNum}
                  </span>
                  {dayInstances.length > 0 && (
                    <div className="flex flex-wrap gap-0.5">
                      {domainsPresent.slice(0, 4).map((d) => (
                        <span key={d} className={`h-1.5 w-1.5 rounded-full ${domainDotClass(d)}`} />
                      ))}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
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
                            title={t.calendar.minutesTitle}
                          />
                        </div>
                        <div className="flex gap-2 pt-0.5">
                          <button type="submit" className="text-[11px] font-semibold text-brand-600 hover:text-brand-700">
                            {t.common.save}
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className="text-[11px] font-medium text-slate-400 hover:text-slate-600"
                          >
                            {t.common.cancel}
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
                        <p className="ml-3 mt-0.5 text-[10px] text-slate-400">
                          {inst.durationMinutes} {t.common.minutesShort}
                        </p>
                        <div className="ml-3 mt-1.5 flex flex-wrap items-center gap-1">
                          {inst.status !== "completed" && (
                            <>
                              <button
                                onClick={() => startPomodoro(inst.id, inst.title)}
                                className="rounded p-1 text-brand-600 hover:bg-brand-50"
                                title={t.pomodoro.start}
                                aria-label={t.pomodoro.start}
                              >
                                <Play size={13} strokeWidth={2.5} />
                              </button>
                              <button
                                onClick={() => setStatus(inst.id, "completed")}
                                className="rounded p-1 text-emerald-600 hover:bg-emerald-50"
                                title={t.calendar.markDone}
                                aria-label={t.calendar.markDone}
                              >
                                <CheckCircle2 size={13} strokeWidth={2.5} />
                              </button>
                              <button
                                onClick={() => setStatus(inst.id, "skipped")}
                                className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                                title={t.calendar.skip}
                                aria-label={t.calendar.skip}
                              >
                                <Circle size={13} strokeWidth={2.5} />
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => startEdit(inst)}
                            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                            title={t.common.edit}
                            aria-label={t.common.edit}
                          >
                            <Pencil size={13} strokeWidth={2.5} />
                          </button>
                        </div>
                      </div>
                    )
                  )}
                </div>

                {quickAddDate === date ? (
                  <form onSubmit={submitQuickAdd} className="mt-2 space-y-1.5 rounded-lg border border-brand-300 bg-brand-50/40 p-2">
                    <input
                      autoFocus
                      value={quickAddForm.title}
                      onChange={(e) => setQuickAddForm({ ...quickAddForm, title: e.target.value })}
                      placeholder={t.calendar.quickAddPlaceholder}
                      className={`${fieldClass} w-full`}
                      required
                    />
                    <div className="flex gap-1">
                      <select
                        value={quickAddForm.domain}
                        onChange={(e) => setQuickAddForm({ ...quickAddForm, domain: e.target.value as LifeDomain })}
                        className={`${fieldClass} flex-1 text-[10px]`}
                      >
                        {LIFE_DOMAINS.map((d) => (
                          <option key={d} value={d}>
                            {domainLabels[d]}
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min={5}
                        value={quickAddForm.durationMinutes}
                        onChange={(e) => setQuickAddForm({ ...quickAddForm, durationMinutes: Number(e.target.value) })}
                        className={`${fieldClass} w-14 text-[10px]`}
                        title={t.calendar.minutesTitle}
                      />
                    </div>
                    <div className="flex gap-2 pt-0.5">
                      <button type="submit" className="text-[11px] font-semibold text-brand-600 hover:text-brand-700">
                        {t.calendar.quickAddSave}
                      </button>
                      <button
                        type="button"
                        onClick={() => setQuickAddDate(null)}
                        className="text-[11px] font-medium text-slate-400 hover:text-slate-600"
                      >
                        {t.common.cancel}
                      </button>
                    </div>
                  </form>
                ) : (
                  <button
                    onClick={() => startQuickAdd(date)}
                    className="mt-2 flex w-full items-center justify-center gap-1 rounded-lg border border-dashed border-slate-200 py-1.5 text-[11px] font-medium text-slate-400 hover:border-brand-300 hover:text-brand-600"
                    title={t.calendar.addTask}
                    aria-label={t.calendar.addTask}
                  >
                    <Plus size={12} strokeWidth={2.5} />
                    {t.calendar.addTask}
                  </button>
                )}
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
