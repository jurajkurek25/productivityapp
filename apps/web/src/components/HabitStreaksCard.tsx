import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Flame } from "lucide-react";
import { api, type StepStreak } from "../lib/api";
import { Card } from "./Card";
import { DomainBadge } from "./DomainBadge";
import { t } from "../lib/i18n";

export function HabitStreaksCard() {
  const [items, setItems] = useState<StepStreak[] | null>(null);

  useEffect(() => {
    api.getStepStreaks().then(setItems);
  }, []);

  return (
    <Card>
      <h2 className="mb-4 text-sm font-medium text-slate-500">{t.weeklyReview.habitStreaksTitle}</h2>
      {items === null ? (
        <div className="space-y-3">
          {[0, 1].map((i) => (
            <div key={i} className="h-12 animate-pulse rounded-lg bg-slate-100" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-slate-400">{t.weeklyReview.habitStreaksEmpty}</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {items.map((s) => (
            <li key={s.stepId} className="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0 last:pb-0">
              <div className="min-w-0">
                <Link to={`/goals/${s.goalId}`} className="truncate text-sm font-medium text-slate-700 hover:text-brand-700">
                  {s.title}
                </Link>
                <div className="mt-1">
                  <DomainBadge domain={s.domain} />
                </div>
              </div>
              {s.streak > 0 ? (
                <span className="flex shrink-0 items-center gap-1.5 text-sm font-semibold text-amber-600">
                  <Flame size={14} strokeWidth={2.25} />
                  {t.weeklyReview.habitStreakLabel(s.streak, s.freq)}
                </span>
              ) : (
                <span className="shrink-0 text-xs text-slate-400">{t.weeklyReview.noStreakYet}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
