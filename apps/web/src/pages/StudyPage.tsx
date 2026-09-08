import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { AlertCircle, CalendarCheck, Plus, Trash2 } from "lucide-react";
import type { StudyPlan } from "@productivityapp/core";
import { api } from "../lib/api";
import { addDaysISO, todayISO } from "../lib/date";
import { Card } from "../components/Card";
import { Button } from "../components/Button";
import { t } from "../lib/i18n";

const fieldClass =
  "rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";

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
      setError(t.study.errorMissingFields);
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
      setError(t.study.errorBuildFailed);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900">{t.study.title}</h1>
        <p className="mt-1 text-sm text-slate-500">{t.study.subtitle}</p>
      </div>

      <Card>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">{t.study.examTitle}</label>
            <input
              value={goalTitle}
              onChange={(e) => setGoalTitle(e.target.value)}
              placeholder={t.study.examTitlePlaceholder}
              className={`${fieldClass} w-full`}
              required
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">{t.study.startDate}</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={`${fieldClass} w-full`} />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">{t.study.examDate}</label>
              <input type="date" value={examDate} onChange={(e) => setExamDate(e.target.value)} className={`${fieldClass} w-full`} />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">{t.study.dailyMinutes}</label>
              <input
                type="number"
                min={15}
                value={dailyCapacity}
                onChange={(e) => setDailyCapacity(Number(e.target.value))}
                className={`${fieldClass} w-full`}
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">{t.study.materialsTitle}</label>
            <div className="space-y-2">
              {materials.map((m, i) => (
                <div key={i} className="flex flex-wrap gap-2">
                  <input
                    value={m.title}
                    onChange={(e) => updateMaterial(i, { title: e.target.value })}
                    placeholder={t.study.topicPlaceholder}
                    className={`${fieldClass} w-full min-w-[10rem] flex-1 sm:w-auto`}
                  />
                  <input
                    type="number"
                    min={5}
                    value={m.estimatedMinutes}
                    onChange={(e) => updateMaterial(i, { estimatedMinutes: Number(e.target.value) })}
                    title={t.study.dailyMinutes}
                    className={`${fieldClass} w-20`}
                  />
                  <select
                    value={m.difficulty}
                    onChange={(e) => updateMaterial(i, { difficulty: Number(e.target.value) })}
                    title={t.study.materialsTitle}
                    className={`${fieldClass} w-28`}
                  >
                    {[1, 2, 3, 4, 5].map((d) => (
                      <option key={d} value={d}>
                        {t.study.difficulty(d)}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setMaterials((prev) => prev.filter((_, idx) => idx !== i))}
                    className="rounded-md p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"
                    title={t.common.remove}
                    aria-label={t.common.remove}
                  >
                    <Trash2 size={16} strokeWidth={2.25} />
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setMaterials((prev) => [...prev, { title: "", estimatedMinutes: 60, difficulty: 3 }])}
              className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:text-brand-700"
            >
              <Plus size={14} strokeWidth={2.5} />
              {t.study.addMaterial}
            </button>
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-700">
              <AlertCircle size={16} strokeWidth={2.25} className="shrink-0" />
              {error}
            </div>
          )}

          <Button type="submit" variant="primary" disabled={submitting}>
            {submitting ? t.study.buildingPlan : t.study.buildPlan}
          </Button>
        </form>
      </Card>

      {result && (
        <Card>
          <div className="mb-4 flex items-start gap-2.5 rounded-lg bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800">
            <CalendarCheck size={16} strokeWidth={2.25} className="mt-0.5 shrink-0" />
            <span>
              {t.study.scheduledSummary(result.scheduledCount, result.plan.days.length)}{" "}
              <Link to="/calendar" className="font-medium underline">
                {t.study.viewOnCalendar}
              </Link>
            </span>
          </div>
          <div className="space-y-2 text-sm">
            {result.plan.days.map((day) => (
              <div key={day.date} className="flex items-start justify-between border-b border-slate-100 pb-2">
                <span className="w-28 shrink-0 text-slate-500">{day.date}</span>
                <span className="flex-1 text-slate-700">
                  {day.items
                    .map(
                      (item) =>
                        `${item.title} (${item.minutes} ${t.common.minutesShort}${item.isReview ? t.study.reviewSuffix : ""})`
                    )
                    .join(", ")}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
