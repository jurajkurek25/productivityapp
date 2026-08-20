import { FormEvent, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { Goal, RecurrenceFrequency, Step, SuggestedStep } from "@productivityapp/core";
import { api } from "../lib/api";
import { DomainBadge } from "../components/DomainBadge";

function recurrenceLabel(step: Pick<Step, "recurrence">): string {
  const { freq, daysOfWeek } = step.recurrence;
  if (freq === "once") return "One-off";
  if (freq === "daily") return daysOfWeek?.length ? `Daily (${daysOfWeek.length} days/week)` : "Daily";
  if (freq === "weekly") return "Weekly";
  return "Monthly";
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

  if (loading || !goal) return <p className="text-slate-400">Loading…</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{goal.title}</h1>
          <div className="mt-1 flex items-center gap-3">
            <DomainBadge domain={goal.domain} />
            {goal.targetDate && <span className="text-xs text-slate-400">Target: {goal.targetDate}</span>}
          </div>
        </div>
        <button onClick={removeGoal} className="text-sm text-red-600 hover:underline">
          Delete goal
        </button>
      </div>

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
            {goal.steps.map((step) => (
              <li key={step.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm font-medium">{step.title}</p>
                  <p className="text-xs text-slate-400">
                    {step.estimatedMinutes}m · {recurrenceLabel(step)}
                    {step.aiSuggested && " · AI-suggested"}
                  </p>
                </div>
                <button onClick={() => removeStep(step.id)} className="text-xs text-red-500 hover:underline">
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
