import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { LIFE_DOMAINS, type Goal, type GoalStatus, type LifeDomain } from "@productivityapp/core";
import { api } from "../lib/api";
import { DomainBadge } from "../components/DomainBadge";

interface GoalFormState {
  domain: LifeDomain;
  title: string;
  targetDate: string;
  status: GoalStatus;
}

function formStateFromGoal(g: Goal): GoalFormState {
  return { domain: g.domain, title: g.title, targetDate: g.targetDate ?? "", status: g.status };
}

function GoalFields({
  state,
  onChange,
  showStatus,
}: {
  state: GoalFormState;
  onChange: (patch: Partial<GoalFormState>) => void;
  showStatus?: boolean;
}) {
  return (
    <>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Domain</label>
          <select
            value={state.domain}
            onChange={(e) => onChange({ domain: e.target.value as LifeDomain })}
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
          <label className="mb-1 block text-sm font-medium text-slate-700">Target date (optional)</label>
          <input
            type="date"
            value={state.targetDate}
            onChange={(e) => onChange({ targetDate: e.target.value })}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Title</label>
        <input
          value={state.title}
          onChange={(e) => onChange({ title: e.target.value })}
          placeholder="e.g. Grow my YouTube channel"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          required
        />
      </div>
      {showStatus && (
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Status</label>
          <select
            value={state.status}
            onChange={(e) => onChange({ status: e.target.value as GoalStatus })}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            {(["active", "paused", "completed", "abandoned"] satisfies GoalStatus[]).map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      )}
    </>
  );
}

const EMPTY_FORM: GoalFormState = { domain: "business", title: "", targetDate: "", status: "active" };

export function GoalsPage() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [createState, setCreateState] = useState<GoalFormState>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editState, setEditState] = useState<GoalFormState>(EMPTY_FORM);

  function load() {
    setLoading(true);
    api
      .listGoals()
      .then(setGoals)
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function handleCreateSubmit(e: FormEvent) {
    e.preventDefault();
    if (!createState.title.trim()) return;
    await api.createGoal({
      domain: createState.domain,
      title: createState.title.trim(),
      targetDate: createState.targetDate || undefined,
    });
    setCreateState(EMPTY_FORM);
    setShowForm(false);
    load();
  }

  function startEdit(g: Goal) {
    setEditingId(g.id);
    setEditState(formStateFromGoal(g));
  }

  async function handleEditSubmit(e: FormEvent) {
    e.preventDefault();
    if (!editingId || !editState.title.trim()) return;
    await api.updateGoal(editingId, {
      domain: editState.domain,
      title: editState.title.trim(),
      targetDate: editState.targetDate || undefined,
      status: editState.status,
    });
    setEditingId(null);
    load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Goals</h1>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          {showForm ? "Cancel" : "New goal"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreateSubmit} className="space-y-4 rounded-xl border border-slate-200 bg-white p-6">
          <GoalFields state={createState} onChange={(patch) => setCreateState((s) => ({ ...s, ...patch }))} />
          <button
            type="submit"
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            Create goal
          </button>
        </form>
      )}

      {loading ? (
        <p className="text-slate-400">Loading…</p>
      ) : goals.length === 0 ? (
        <p className="text-slate-400">No goals yet. Create one to get a suggested breakdown into steps.</p>
      ) : (
        <ul className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
          {goals.map((g) =>
            editingId === g.id ? (
              <li key={g.id} className="px-5 py-4">
                <form onSubmit={handleEditSubmit} className="space-y-4">
                  <GoalFields
                    state={editState}
                    onChange={(patch) => setEditState((s) => ({ ...s, ...patch }))}
                    showStatus
                  />
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="rounded-md border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </li>
            ) : (
              <li key={g.id} className="flex items-center justify-between px-5 py-4 hover:bg-slate-50">
                <Link to={`/goals/${g.id}`} className="flex-1">
                  <p className="font-medium">{g.title}</p>
                  <div className="mt-1 flex items-center gap-3">
                    <DomainBadge domain={g.domain} />
                    {g.targetDate && <span className="text-xs text-slate-400">Target: {g.targetDate}</span>}
                  </div>
                </Link>
                <div className="flex items-center gap-3">
                  <span className="text-xs uppercase tracking-wide text-slate-400">{g.status}</span>
                  <button
                    onClick={() => startEdit(g)}
                    className="text-xs font-medium text-slate-600 hover:underline"
                  >
                    Edit
                  </button>
                </div>
              </li>
            )
          )}
        </ul>
      )}
    </div>
  );
}
