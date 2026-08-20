import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import type { StudyPlan } from "@productivityapp/core";
import { api } from "../lib/api";
import { addDaysISO, todayISO } from "../lib/date";

interface MaterialRow {
  title: string;
  estimatedMinutes: number;
  difficulty: number;
}

export function StudyPage() {
  const [goalTitle, setGoalTitle] = useState("");
  const [startDate, setStartDate] = useState(todayISO());
  const [examDate, setExamDate] = useState(addDaysISO(todayISO(), 14));
  const [dailyCapacity, setDailyCapacity] = useState(60);
  const [materials, setMaterials] = useState<MaterialRow[]>([{ title: "", estimatedMinutes: 60, difficulty: 3 }]);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ plan: StudyPlan; scheduledCount: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  function updateMaterial(i: number, patch: Partial<MaterialRow>) {
    setMaterials((prev) => prev.map((m, idx) => (idx === i ? { ...m, ...patch } : m)));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const cleanMaterials = materials.filter((m) => m.title.trim());
    if (!goalTitle.trim() || cleanMaterials.length === 0) {
      setError("Add a title and at least one study material.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.createStudyPlan({
        goalTitle: goalTitle.trim(),
        examDate,
        startDate,
        materials: cleanMaterials,
        dailyCapacityMinutes: dailyCapacity,
      });
      setResult({ plan: res.plan, scheduledCount: res.scheduled.length });
    } catch {
      setError("Could not build the study plan. Check your dates.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Study plan</h1>
        <p className="text-sm text-slate-500">
          Split your material into a day-by-day plan up to the exam. It's scheduled through the same calendar and
          energy system as everything else.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5 rounded-xl border border-slate-200 bg-white p-6">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Exam / goal title</label>
          <input
            value={goalTitle}
            onChange={(e) => setGoalTitle(e.target.value)}
            placeholder="e.g. Pass Algorithms Exam"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            required
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Start date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Exam date</label>
            <input
              type="date"
              value={examDate}
              onChange={(e) => setExamDate(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Daily study minutes</label>
            <input
              type="number"
              min={15}
              value={dailyCapacity}
              onChange={(e) => setDailyCapacity(Number(e.target.value))}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">Study materials / topics</label>
          <div className="space-y-2">
            {materials.map((m, i) => (
              <div key={i} className="flex gap-2">
                <input
                  value={m.title}
                  onChange={(e) => updateMaterial(i, { title: e.target.value })}
                  placeholder="Topic name"
                  className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
                <input
                  type="number"
                  min={5}
                  value={m.estimatedMinutes}
                  onChange={(e) => updateMaterial(i, { estimatedMinutes: Number(e.target.value) })}
                  title="Estimated minutes"
                  className="w-24 rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
                <select
                  value={m.difficulty}
                  onChange={(e) => updateMaterial(i, { difficulty: Number(e.target.value) })}
                  title="Difficulty"
                  className="w-32 rounded-md border border-slate-300 px-3 py-2 text-sm"
                >
                  {[1, 2, 3, 4, 5].map((d) => (
                    <option key={d} value={d}>
                      Difficulty {d}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setMaterials((prev) => prev.filter((_, idx) => idx !== i))}
                  className="text-sm text-red-500"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setMaterials((prev) => [...prev, { title: "", estimatedMinutes: 60, difficulty: 3 }])}
            className="mt-2 text-sm text-slate-600 underline"
          >
            + Add material
          </button>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {submitting ? "Building plan…" : "Build & schedule plan"}
        </button>
      </form>

      {result && (
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <p className="mb-3 text-sm font-medium text-slate-700">
            Scheduled {result.scheduledCount} study block(s) across {result.plan.days.length} day(s).{" "}
            <Link to="/calendar" className="text-slate-900 underline">
              View on calendar
            </Link>
          </p>
          <div className="space-y-2 text-sm">
            {result.plan.days.map((day) => (
              <div key={day.date} className="flex items-start justify-between border-b border-slate-100 pb-2">
                <span className="w-28 shrink-0 text-slate-500">{day.date}</span>
                <span className="flex-1 text-slate-700">
                  {day.items.map((item) => `${item.title} (${item.minutes}m${item.isReview ? ", review" : ""})`).join(", ")}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
