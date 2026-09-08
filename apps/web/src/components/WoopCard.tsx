import { useState } from "react";
import type { Goal } from "@productivityapp/core";
import { api } from "../lib/api";
import { Card } from "./Card";
import { Button } from "./Button";
import { t } from "../lib/i18n";

const fieldClass =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";

export function WoopCard({ goal, onUpdated }: { goal: Goal; onUpdated: () => void }) {
  const [editing, setEditing] = useState(false);
  const [obstacle, setObstacle] = useState(goal.obstacle ?? "");
  const [ifThenPlan, setIfThenPlan] = useState(goal.ifThenPlan ?? "");

  function startEdit() {
    setObstacle(goal.obstacle ?? "");
    setIfThenPlan(goal.ifThenPlan ?? "");
    setEditing(true);
  }

  async function save() {
    await api.updateGoal(goal.id, { obstacle: obstacle.trim() || undefined, ifThenPlan: ifThenPlan.trim() || undefined });
    setEditing(false);
    onUpdated();
  }

  const hasContent = Boolean(goal.obstacle || goal.ifThenPlan);

  return (
    <Card>
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-slate-500">{t.goalDetail.woopTitle}</h2>
        {!editing && (
          <button type="button" onClick={startEdit} className="text-xs font-medium text-brand-600 hover:text-brand-700">
            {hasContent ? t.common.edit : t.goalDetail.woopSetup}
          </button>
        )}
      </div>
      {editing ? (
        <div className="mt-3 space-y-3">
          <p className="text-xs text-slate-400">{t.goalDetail.woopSubtitle}</p>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-600">{t.goalDetail.woopObstacleLabel}</label>
            <textarea
              value={obstacle}
              onChange={(e) => setObstacle(e.target.value)}
              placeholder={t.goalDetail.woopObstaclePlaceholder}
              rows={2}
              className={fieldClass}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-600">{t.goalDetail.woopPlanLabel}</label>
            <textarea
              value={ifThenPlan}
              onChange={(e) => setIfThenPlan(e.target.value)}
              placeholder={t.goalDetail.woopPlanPlaceholder}
              rows={2}
              className={fieldClass}
            />
          </div>
          <div className="flex gap-2">
            <Button variant="primary" type="button" onClick={save}>
              {t.common.save}
            </Button>
            <Button variant="secondary" type="button" onClick={() => setEditing(false)}>
              {t.common.cancel}
            </Button>
          </div>
        </div>
      ) : hasContent ? (
        <div className="mt-3 space-y-2 text-sm">
          {goal.obstacle && (
            <p>
              <span className="font-medium text-slate-700">{t.goalDetail.woopObstacleLabel}:</span>{" "}
              <span className="text-slate-600">{goal.obstacle}</span>
            </p>
          )}
          {goal.ifThenPlan && (
            <p>
              <span className="font-medium text-slate-700">{t.goalDetail.woopPlanLabel}:</span>{" "}
              <span className="text-slate-600">{goal.ifThenPlan}</span>
            </p>
          )}
        </div>
      ) : (
        <p className="mt-2 text-sm text-slate-400">{t.goalDetail.woopEmpty}</p>
      )}
    </Card>
  );
}
