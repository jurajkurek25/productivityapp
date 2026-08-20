import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Pencil, Plus, Sparkles, Trash2 } from "lucide-react";
import { LIFE_DOMAINS, type Goal, type GoalStatus, type LifeDomain, type RecurrenceFrequency, type Step, type SuggestedStep } from "@productivityapp/core";
import { api } from "../lib/api";
import { DomainBadge } from "../components/DomainBadge";
import { Card } from "../components/Card";
import { Button } from "../components/Button";
import { domainLabels, frequencyLabels, statusLabels, t } from "../lib/i18n";

const fieldClass =
  "rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";

function recurrenceLabel(step: Pick<Step, "recurrence">): string {
  const { freq, daysOfWeek } = step.recurrence;
  if (freq === "once") return t.recurrenceLabel.once;
  if (freq === "daily") return daysOfWeek?.length ? t.recurrenceLabel.dailyDaysPerWeek(daysOfWeek.length) : t.recurrenceLabel.daily;
  if (freq === "weekly") return t.recurrenceLabel.weekly;
  return t.recurrenceLabel.monthly;
}

interface GoalFormState {
  domain: LifeDomain;
  title: string;
  targetDate: string;
  status: GoalStatus;
}

interface StepFormState {
  domain: LifeDomain;
  title: string;
  estimatedMinutes: number;
  priority: number;
  freq: RecurrenceFrequency;
}

function stepFormFrom(step: Step): StepFormState {
  return {
    domain: step.domain,
    title: step.title,
    estimatedMinutes: step.estimatedMinutes,
    priority: step.priority,
    freq: step.recurrence.freq,
  };
}

export function GoalDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [goal, setGoal] = useState<(Goal & { steps: Step[] }) | null>(null);
  const [suggestions, setSuggestions] = useState<SuggestedStep[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualTitle, setManualTitle] = useState("");
  const [manualMinutes, setManualMinutes] = useState(30);
  const [manualFreq, setManualFreq] = useState<RecurrenceFrequency>("weekly");

  const [editingGoal, setEditingGoal] = useState(false);
  const [goalForm, setGoalForm] = useState<GoalFormState | null>(null);

  const [editingStepId, setEditingStepId] = useState<string | null>(null);
  const [stepForm, setStepForm] = useState<StepFormState | null>(null);

  function load() {
    if (!id) return;
    setLoading(true);
    api
      .getGoal(id)
      .then(setGoal)
      .finally(() => setLoading(false));
  }

  useEffect(load, [id]);

  async function loadSuggestions() {
    if (!id) return;
    setSuggestions(await api.suggestSteps(id));
  }

  async function acceptSuggestion(s: SuggestedStep) {
    if (!goal) return;
    await api.createStep({
      goalId: goal.id,
      domain: goal.domain,
      title: s.title,
      estimatedMinutes: s.estimatedMinutes,
      priority: s.priority,
      recurrence: s.recurrence,
      earliestDate: new Date().toISOString().slice(0, 10),
      aiSuggested: true,
    });
    setSuggestions((prev) => prev?.filter((x) => x.title !== s.title) ?? null);
    load();
  }

  async function handleManualSubmit(e: FormEvent) {
    e.preventDefault();
    if (!goal || !manualTitle.trim()) return;
    await api.createStep({
      goalId: goal.id,
      domain: goal.domain,
      title: manualTitle.trim(),
      estimatedMinutes: manualMinutes,
      recurrence: { freq: manualFreq },
      earliestDate: new Date().toISOString().slice(0, 10),
    });
    setManualTitle("");
    setShowManualForm(false);
    load();
  }

  async function removeStep(stepId: string) {
    await api.deleteStep(stepId);
    load();
  }

  async function removeGoal() {
    if (!goal) return;
    if (!confirm(t.goalDetail.confirmDelete(goal.title))) return;
    await api.deleteGoal(goal.id);
    navigate("/goals");
  }

  function startEditGoal() {
    if (!goal) return;
    setGoalForm({ domain: goal.domain, title: goal.title, targetDate: goal.targetDate ?? "", status: goal.status });
    setEditingGoal(true);
  }

  async function handleGoalEditSubmit(e: FormEvent) {
    e.preventDefault();
    if (!goal || !goalForm || !goalForm.title.trim()) return;
    await api.updateGoal(goal.id, {
      domain: goalForm.domain,
      title: goalForm.title.trim(),
      targetDate: goalForm.targetDate || undefined,
      status: goalForm.status,
    });
    setEditingGoal(false);
    load();
  }

  function startEditStep(step: Step) {
    setEditingStepId(step.id);
    setStepForm(stepFormFrom(step));
  }

  async function handleStepEditSubmit(e: FormEvent) {
    e.preventDefault();
    if (!editingStepId || !stepForm || !stepForm.title.trim()) return;
    await api.updateStep(editingStepId, {
      domain: stepForm.domain,
      title: stepForm.title.trim(),
      estimatedMinutes: stepForm.estimatedMinutes,
      priority: stepForm.priority,
      recurrence: { freq: stepForm.freq },
    });
    setEditingStepId(null);
    load();
  }

  if (loading || !goal) {
    return (
      <div className="space-y-4">
        <div className="h-6 w-40 animate-pulse rounded bg-slate-200" />
        <div className="h-48 animate-pulse rounded-xl border border-slate-200/80 bg-white" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link to="/goals" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft size={14} strokeWidth={2.25} />
        {t.goalDetail.backToGoals}
      </Link>

      {editingGoal && goalForm ? (
        <Card>
          <form onSubmit={handleGoalEditSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">{t.goals.domain}</label>
                <select
                  value={goalForm.domain}
                  onChange={(e) => setGoalForm({ ...goalForm, domain: e.target.value as LifeDomain })}
                  className={`${fieldClass} w-full`}
                >
                  {LIFE_DOMAINS.map((d) => (
                    <option key={d} value={d}>
                      {domainLabels[d]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">{t.goals.targetDateOptional}</label>
                <input
                  type="date"
                  value={goalForm.targetDate}
                  onChange={(e) => setGoalForm({ ...goalForm, targetDate: e.target.value })}
                  className={`${fieldClass} w-full`}
                />
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">{t.goals.goalTitle}</label>
              <input
                value={goalForm.title}
                onChange={(e) => setGoalForm({ ...goalForm, title: e.target.value })}
                className={`${fieldClass} w-full`}
                required
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">{t.goals.status}</label>
              <select
                value={goalForm.status}
                onChange={(e) => setGoalForm({ ...goalForm, status: e.target.value as GoalStatus })}
                className={`${fieldClass} w-full`}
              >
                {(["active", "paused", "completed", "abandoned"] satisfies GoalStatus[]).map((s) => (
                  <option key={s} value={s}>
                    {statusLabels[s]}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <Button type="submit" variant="primary">
                {t.common.save}
              </Button>
              <Button type="button" variant="secondary" onClick={() => setEditingGoal(false)}>
                {t.common.cancel}
              </Button>
            </div>
          </form>
        </Card>
      ) : (
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-display text-2xl font-bold text-slate-900">{goal.title}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <DomainBadge domain={goal.domain} />
              {goal.targetDate && (
                <span className="text-xs text-slate-400">
                  {t.goals.targetPrefix} {goal.targetDate}
                </span>
              )}
              <span className="text-xs font-medium uppercase tracking-wide text-slate-400">{statusLabels[goal.status]}</span>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              onClick={startEditGoal}
              className="rounded-md p-2.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              title={t.goalDetail.editGoal}
              aria-label={t.goalDetail.editGoal}
            >
              <Pencil size={16} strokeWidth={2.25} />
            </button>
            <button
              onClick={removeGoal}
              className="rounded-md p-2.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
              title={t.goalDetail.deleteGoal}
              aria-label={t.goalDetail.deleteGoal}
            >
              <Trash2 size={16} strokeWidth={2.25} />
            </button>
          </div>
        </div>
      )}

      <Card>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-medium text-slate-500">{t.goalDetail.steps}</h2>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" icon={Sparkles} onClick={loadSuggestions}>
              {t.goalDetail.suggestSteps}
            </Button>
            <Button variant="primary" size="sm" icon={Plus} onClick={() => setShowManualForm((v) => !v)}>
              {t.goalDetail.addStep}
            </Button>
          </div>
        </div>

        {suggestions && suggestions.length > 0 && (
          <div className="mb-4 space-y-2 rounded-lg bg-brand-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">{t.goalDetail.suggestedBreakdown}</p>
            {suggestions.map((s) => (
              <div key={s.title} className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-sm shadow-sm">
                <span>
                  {s.title}{" "}
                  <span className="text-slate-400">
                    · {s.estimatedMinutes} {t.common.minutesShort} · {frequencyLabels[s.recurrence.freq]}
                  </span>
                </span>
                <button onClick={() => acceptSuggestion(s)} className="font-medium text-brand-600 hover:text-brand-700">
                  {t.common.add}
                </button>
              </div>
            ))}
          </div>
        )}

        {showManualForm && (
          <form onSubmit={handleManualSubmit} className="mb-4 space-y-3 rounded-lg border border-slate-200 p-4">
            <input
              value={manualTitle}
              onChange={(e) => setManualTitle(e.target.value)}
              placeholder={t.goalDetail.stepTitlePlaceholder}
              className={`${fieldClass} w-full`}
              required
            />
            <div className="flex flex-wrap gap-3">
              <input
                type="number"
                min={5}
                value={manualMinutes}
                onChange={(e) => setManualMinutes(Number(e.target.value))}
                className={`${fieldClass} w-28`}
              />
              <select
                value={manualFreq}
                onChange={(e) => setManualFreq(e.target.value as RecurrenceFrequency)}
                className={`${fieldClass} w-auto`}
              >
                <option value="once">{frequencyLabels.once}</option>
                <option value="daily">{frequencyLabels.daily}</option>
                <option value="weekly">{frequencyLabels.weekly}</option>
                <option value="monthly">{frequencyLabels.monthly}</option>
              </select>
              <Button type="submit" variant="primary">
                {t.common.save}
              </Button>
            </div>
          </form>
        )}

        {goal.steps.length === 0 ? (
          <p className="text-sm text-slate-400">{t.goalDetail.noStepsYet}</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {goal.steps.map((step) =>
              editingStepId === step.id && stepForm ? (
                <li key={step.id} className="py-3">
                  <form onSubmit={handleStepEditSubmit} className="space-y-3 rounded-lg border border-slate-200 p-4">
                    <input
                      value={stepForm.title}
                      onChange={(e) => setStepForm({ ...stepForm, title: e.target.value })}
                      className={`${fieldClass} w-full`}
                      required
                    />
                    <div className="flex flex-wrap gap-3">
                      <select
                        value={stepForm.domain}
                        onChange={(e) => setStepForm({ ...stepForm, domain: e.target.value as LifeDomain })}
                        className={`${fieldClass} w-auto`}
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
                        value={stepForm.estimatedMinutes}
                        onChange={(e) => setStepForm({ ...stepForm, estimatedMinutes: Number(e.target.value) })}
                        className={`${fieldClass} w-24`}
                        title={t.calendar.minutesTitle}
                      />
                      <select
                        value={stepForm.priority}
                        onChange={(e) => setStepForm({ ...stepForm, priority: Number(e.target.value) })}
                        className={`${fieldClass} w-auto`}
                        title={t.goals.status}
                      >
                        {[1, 2, 3, 4, 5].map((p) => (
                          <option key={p} value={p}>
                            {t.goalDetail.priority(p)}
                          </option>
                        ))}
                      </select>
                      <select
                        value={stepForm.freq}
                        onChange={(e) => setStepForm({ ...stepForm, freq: e.target.value as RecurrenceFrequency })}
                        className={`${fieldClass} w-auto`}
                      >
                        <option value="once">{frequencyLabels.once}</option>
                        <option value="daily">{frequencyLabels.daily}</option>
                        <option value="weekly">{frequencyLabels.weekly}</option>
                        <option value="monthly">{frequencyLabels.monthly}</option>
                      </select>
                    </div>
                    <div className="flex gap-2">
                      <Button type="submit" variant="primary">
                        {t.common.save}
                      </Button>
                      <Button type="button" variant="secondary" onClick={() => setEditingStepId(null)}>
                        {t.common.cancel}
                      </Button>
                    </div>
                  </form>
                </li>
              ) : (
                <li key={step.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-800">{step.title}</p>
                    <p className="text-xs text-slate-400">
                      {step.estimatedMinutes} {t.common.minutesShort} · {recurrenceLabel(step)}
                      {step.aiSuggested && ` · ${t.goalDetail.aiSuggested}`}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      onClick={() => startEditStep(step)}
                      className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                      title={t.goalDetail.editStep}
                      aria-label={t.goalDetail.editStep}
                    >
                      <Pencil size={14} strokeWidth={2.25} />
                    </button>
                    <button
                      onClick={() => removeStep(step.id)}
                      className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                      title={t.goalDetail.removeStep}
                      aria-label={t.goalDetail.removeStep}
                    >
                      <Trash2 size={14} strokeWidth={2.25} />
                    </button>
                  </div>
                </li>
              )
            )}
          </ul>
        )}
      </Card>
    </div>
  );
}
