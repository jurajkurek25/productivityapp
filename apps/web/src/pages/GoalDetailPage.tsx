import { FormEvent, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { LIFE_DOMAINS, type Goal, type GoalStatus, type LifeDomain, type RecurrenceFrequency, type Step, type SuggestedStep } from "@productivityapp/core";
import { api } from "../lib/api";
import { DomainBadge } from "../components/DomainBadge";

function recurrenceLabel(step: Pick<Step, "recurrence">): string {
  const { freq, daysOfWeek } = step.recurrence;
  if (freq === "once") return "One-off";
  if (freq === "daily") return daysOfWeek?.length ? `Daily (${daysOfWeek.length} days/week)` : "Daily";
  if (freq === "weekly") return "Weekly";
  return "Monthly";
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
    if (!confirm(`Delete goal "${goal.title}" and all its steps?`)) return;
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

  if (loading || !goal) return <p className="text-slate-400">Loading…</p>;

  return (
    <div className="space-y-6">
      {editingGoal && goalForm ? (
        <form onSubmit={handleGoalEditSubmit} className="space-y-4 rounded-xl border border-slate-200 bg-white p-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Domain</label>
              <select
                value={goalForm.domain}
                onChange={(e) => setGoalForm({ ...goalForm, domain: e.target.value as LifeDomain })}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              >
                {LIFE_DOMAINS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Target date</label>
              <input
                type="date"
                value={goalForm.targetDate}
                onChange={(e) => setGoalForm({ ...goalForm, targetDate: e.target.value })}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Title</label>
            <input
              value={goalForm.title}
              onChange={(e) => setGoalForm({ ...goalForm, title: e.target.value })}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Status</label>
            <select
              value={goalForm.status}
              onChange={(e) => setGoalForm({ ...goalForm, status: e.target.value as GoalStatus })}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              {(["active", "paused", "completed", "abandoned"] satisfies GoalStatus[]).map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">
              Save
            </button>
            <button
              type="button"
              onClick={() => setEditingGoal(false)}
              className="rounded-md border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold">{goal.title}</h1>
            <div className="mt-1 flex items-center gap-3">
              <DomainBadge domain={goal.domain} />
              {goal.targetDate && <span className="text-xs text-slate-400">Target: {goal.targetDate}</span>}
              <span className="text-xs uppercase tracking-wide text-slate-400">{goal.status}</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={startEditGoal} className="text-sm text-slate-600 hover:underline">
              Edit goal
            </button>
            <button onClick={removeGoal} className="text-sm text-red-600 hover:underline">
              Delete goal
            </button>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-medium text-slate-500">Steps</h2>
          <div className="flex gap-2">
            <button onClick={loadSuggestions} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50">
              Suggest steps
            </button>
            <button
              onClick={() => setShowManualForm((v) => !v)}
              className="rounded-md bg-slate-900 px-3 py-1.5 text-sm text-white hover:bg-slate-800"
            >
              Add step
            </button>
          </div>
        </div>

        {suggestions && suggestions.length > 0 && (
          <div className="mb-4 space-y-2 rounded-md bg-indigo-50 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-indigo-700">Suggested breakdown</p>
            {suggestions.map((s) => (
              <div key={s.title} className="flex items-center justify-between rounded-md bg-white px-3 py-2 text-sm">
                <span>
                  {s.title} <span className="text-slate-400">· {s.estimatedMinutes}m · {s.recurrence.freq}</span>
                </span>
                <button onClick={() => acceptSuggestion(s)} className="text-indigo-600 hover:underline">
                  Add
                </button>
              </div>
            ))}
          </div>
        )}

        {showManualForm && (
          <form onSubmit={handleManualSubmit} className="mb-4 space-y-3 rounded-md border border-slate-200 p-4">
            <input
              value={manualTitle}
              onChange={(e) => setManualTitle(e.target.value)}
              placeholder="Step title"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              required
            />
            <div className="flex gap-3">
              <input
                type="number"
                min={5}
                value={manualMinutes}
                onChange={(e) => setManualMinutes(Number(e.target.value))}
                className="w-28 rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
              <select
                value={manualFreq}
                onChange={(e) => setManualFreq(e.target.value as RecurrenceFrequency)}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="once">Once</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
              <button type="submit" className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white">
                Save
              </button>
            </div>
          </form>
        )}

        {goal.steps.length === 0 ? (
          <p className="text-sm text-slate-400">No steps yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {goal.steps.map((step) =>
              editingStepId === step.id && stepForm ? (
                <li key={step.id} className="py-3">
                  <form onSubmit={handleStepEditSubmit} className="space-y-3 rounded-md border border-slate-200 p-4">
                    <input
                      value={stepForm.title}
                      onChange={(e) => setStepForm({ ...stepForm, title: e.target.value })}
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                      required
                    />
                    <div className="flex flex-wrap gap-3">
                      <select
                        value={stepForm.domain}
                        onChange={(e) => setStepForm({ ...stepForm, domain: e.target.value as LifeDomain })}
                        className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                      >
                        {LIFE_DOMAINS.map((d) => (
                          <option key={d} value={d}>
                            {d}
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min={5}
                        value={stepForm.estimatedMinutes}
                        onChange={(e) => setStepForm({ ...stepForm, estimatedMinutes: Number(e.target.value) })}
                        className="w-24 rounded-md border border-slate-300 px-3 py-2 text-sm"
                        title="Minutes"
                      />
                      <select
                        value={stepForm.priority}
                        onChange={(e) => setStepForm({ ...stepForm, priority: Number(e.target.value) })}
                        className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                        title="Priority"
                      >
                        {[1, 2, 3, 4, 5].map((p) => (
                          <option key={p} value={p}>
                            Priority {p}
                          </option>
                        ))}
                      </select>
                      <select
                        value={stepForm.freq}
                        onChange={(e) => setStepForm({ ...stepForm, freq: e.target.value as RecurrenceFrequency })}
                        className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                      >
                        <option value="once">Once</option>
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                        <option value="monthly">Monthly</option>
                      </select>
                    </div>
                    <div className="flex gap-2">
                      <button type="submit" className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800">
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingStepId(null)}
                        className="rounded-md border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                </li>
              ) : (
                <li key={step.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium">{step.title}</p>
                    <p className="text-xs text-slate-400">
                      {step.estimatedMinutes}m · {recurrenceLabel(step)}
                      {step.aiSuggested && " · AI-suggested"}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button onClick={() => startEditStep(step)} className="text-xs text-slate-600 hover:underline">
                      Edit
                    </button>
                    <button onClick={() => removeStep(step.id)} className="text-xs text-red-500 hover:underline">
                      Remove
                    </button>
                  </div>
                </li>
              )
            )}
          </ul>
        )}
      </div>
    </div>
  );
}
