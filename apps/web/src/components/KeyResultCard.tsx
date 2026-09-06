import { FormEvent, useState } from "react";
import type { Goal } from "@productivityapp/core";
import { api } from "../lib/api";
import { Card } from "./Card";
import { Button } from "./Button";
import { t } from "../lib/i18n";

const fieldClass =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";

export function KeyResultCard({ goal, onUpdated }: { goal: Goal; onUpdated: () => void }) {
  const [editing, setEditing] = useState(false);
  const [target, setTarget] = useState(goal.keyResultTarget ? String(goal.keyResultTarget) : "");
  const [unit, setUnit] = useState(goal.keyResultUnit ?? "");
  const [addAmount, setAddAmount] = useState("");

  const hasTarget = goal.keyResultTarget != null && goal.keyResultUnit != null;
  const current = goal.keyResultCurrent ?? 0;
  const met = hasTarget && current >= (goal.keyResultTarget ?? 0);

  function startEdit() {
    setTarget(goal.keyResultTarget ? String(goal.keyResultTarget) : "");
    setUnit(goal.keyResultUnit ?? "");
    setEditing(true);
  }

  async function saveSetup(e: FormEvent) {
    e.preventDefault();
    const numTarget = Number(target);
    if (!numTarget || !unit.trim()) return;
    await api.updateGoal(goal.id, { keyResultTarget: numTarget, keyResultUnit: unit.trim() });
    setEditing(false);
    onUpdated();
  }

  async function addProgress() {
    const delta = Number(addAmount);
    if (!delta) return;
    await api.updateGoal(goal.id, { keyResultCurrent: current + delta });
    setAddAmount("");
    onUpdated();
  }

  return (
    <Card>
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-slate-500">{t.goalDetail.keyResultTitle}</h2>
        {!editing && (
          <button type="button" onClick={startEdit} className="text-xs font-medium text-brand-600 hover:text-brand-700">
            {hasTarget ? t.common.edit : t.goalDetail.keyResultSetup}
          </button>
        )}
      </div>
      {editing ? (
        <form onSubmit={saveSetup} className="mt-3 space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-600">{t.goalDetail.keyResultTargetLabel}</label>
              <input
                type="number"
                min={1}
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                placeholder={t.goalDetail.keyResultTargetPlaceholder}
                className={fieldClass}
                required
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-600">{t.goalDetail.keyResultUnitLabel}</label>
              <input
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder={t.goalDetail.keyResultUnitPlaceholder}
                className={fieldClass}
                required
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button type="submit" variant="primary">
              {t.common.save}
            </Button>
            <Button type="button" variant="secondary" onClick={() => setEditing(false)}>
              {t.common.cancel}
            </Button>
          </div>
        </form>
      ) : hasTarget ? (
        <div className="mt-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium text-slate-700">
              {t.goalDetail.keyResultProgress(current, goal.keyResultTarget!, goal.keyResultUnit!)}
            </span>
            {met && (
              <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                {t.goalDetail.keyResultMet}
              </span>
            )}
          </div>
          <div className="mt-2 h-2 w-full rounded-full bg-slate-100">
            <div
              className={`h-2 rounded-full ${met ? "bg-emerald-500" : "bg-brand-600"}`}
              style={{ width: `${Math.min(100, (current / goal.keyResultTarget!) * 100)}%` }}
            />
          </div>
          <div className="mt-3 flex gap-2">
            <input
              type="number"
              value={addAmount}
              onChange={(e) => setAddAmount(e.target.value)}
              placeholder={t.goalDetail.keyResultAddPlaceholder}
              className={`${fieldClass} w-28`}
            />
            <Button type="button" variant="secondary" size="sm" onClick={addProgress}>
              {t.goalDetail.keyResultAdd}
            </Button>
          </div>
        </div>
      ) : (
        <p className="mt-2 text-sm text-slate-400">{t.goalDetail.keyResultEmpty}</p>
      )}
    </Card>
  );
}
