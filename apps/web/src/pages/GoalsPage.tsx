import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, Pencil, Plus, Target } from "lucide-react";
import { LIFE_DOMAINS, type Goal, type GoalStatus, type LifeDomain } from "@productivityapp/core";
import { api } from "../lib/api";
import { DomainBadge } from "../components/DomainBadge";
import { Card } from "../components/Card";
import { Button } from "../components/Button";
import { domainLabels, statusLabels, t } from "../lib/i18n";

interface GoalFormState {
  domain: LifeDomain;
  title: string;
  targetDate: string;
  weeklyTargetMinutes: string;
  status: GoalStatus;
}

function formStateFromGoal(g: Goal): GoalFormState {
  return {
    domain: g.domain,
    title: g.title,
    targetDate: g.targetDate ?? "",
    weeklyTargetMinutes: g.weeklyTargetMinutes != null ? String(g.weeklyTargetMinutes) : "",
    status: g.status,
  };
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
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">{t.goals.domain}</label>
          <select
            value={state.domain}
            onChange={(e) => onChange({ domain: e.target.value as LifeDomain })}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
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
            value={state.targetDate}
            onChange={(e) => onChange({ targetDate: e.target.value })}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">{t.goals.weeklyTargetOptional}</label>
          <input
            type="number"
            min={0}
            max={10080}
            value={state.weeklyTargetMinutes}
            onChange={(e) => onChange({ weeklyTargetMinutes: e.target.value })}
            placeholder={t.goals.weeklyTargetPlaceholder}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium text-slate-700">{t.goals.goalTitle}</label>
        <input
          value={state.title}
          onChange={(e) => onChange({ title: e.target.value })}
          placeholder={t.goals.titlePlaceholder}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          required
        />
      </div>
      {showStatus && (
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">{t.goals.status}</label>
          <select
            value={state.status}
            onChange={(e) => onChange({ status: e.target.value as GoalStatus })}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          >
            {(["active", "paused", "completed", "abandoned"] satisfies GoalStatus[]).map((s) => (
              <option key={s} value={s}>
                {statusLabels[s]}
              </option>
            ))}
          </select>
        </div>
      )}
    </>
  );
}

const EMPTY_FORM: GoalFormState = {
  domain: "business",
  title: "",
  targetDate: "",
  weeklyTargetMinutes: "",
  status: "active",
};

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
      weeklyTargetMinutes: createState.weeklyTargetMinutes ? Number(createState.weeklyTargetMinutes) : undefined,
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
      weeklyTargetMinutes: editState.weeklyTargetMinutes ? Number(editState.weeklyTargetMinutes) : undefined,
      status: editState.status,
    });
    setEditingId(null);
    load();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">{t.goals.title}</h1>
          <p className="mt-1 text-sm text-slate-500">{t.goals.subtitle}</p>
        </div>
        <Button variant="primary" icon={showForm ? undefined : Plus} onClick={() => setShowForm((v) => !v)}>
          {showForm ? t.common.cancel : t.goals.newGoal}
        </Button>
      </div>

      {showForm && (
        <Card>
          <form onSubmit={handleCreateSubmit} className="space-y-4">
            <GoalFields state={createState} onChange={(patch) => setCreateState((s) => ({ ...s, ...patch }))} />
            <Button type="submit" variant="primary">
              {t.goals.createGoal}
            </Button>
          </form>
        </Card>
      )}

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl border border-slate-200/80 bg-white" />
          ))}
        </div>
      ) : goals.length === 0 ? (
        <Card className="flex flex-col items-center py-14 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-600">
            <Target size={22} strokeWidth={2} />
          </div>
          <p className="text-sm font-medium text-slate-700">{t.goals.emptyTitle}</p>
          <p className="mt-1 max-w-xs text-sm text-slate-400">{t.goals.emptyBody}</p>
        </Card>
      ) : (
        <div className="divide-y divide-slate-100 rounded-xl border border-slate-200/80 bg-white shadow-card">
          {goals.map((g) =>
            editingId === g.id ? (
              <div key={g.id} className="px-6 py-5">
                <form onSubmit={handleEditSubmit} className="space-y-4">
                  <GoalFields
                    state={editState}
                    onChange={(patch) => setEditState((s) => ({ ...s, ...patch }))}
                    showStatus
                  />
                  <div className="flex gap-2">
                    <Button type="submit" variant="primary">
                      {t.common.save}
                    </Button>
                    <Button type="button" variant="secondary" onClick={() => setEditingId(null)}>
                      {t.common.cancel}
                    </Button>
                  </div>
                </form>
              </div>
            ) : (
              <div key={g.id} className="group flex flex-wrap items-center justify-between gap-3 px-4 py-4 hover:bg-slate-50 sm:px-6">
                <Link to={`/goals/${g.id}`} className="flex min-w-0 flex-1 items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-800">{g.title}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-3">
                      <DomainBadge domain={g.domain} />
                      {g.targetDate && (
                        <span className="text-xs text-slate-400">
                          {t.goals.targetPrefix} {g.targetDate}
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronRight size={16} className="shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5" />
                </Link>
                <div className="ml-4 flex shrink-0 items-center gap-3 border-l border-slate-100 pl-4">
                  <span className="text-xs font-medium uppercase tracking-wide text-slate-400">{statusLabels[g.status]}</span>
                  <button
                    onClick={() => startEdit(g)}
                    className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                    title={t.common.edit}
                    aria-label={t.common.edit}
                  >
                    <Pencil size={14} strokeWidth={2.25} />
                  </button>
                </div>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}
