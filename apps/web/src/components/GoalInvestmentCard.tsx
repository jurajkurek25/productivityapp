import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type GoalTimeInvestment } from "../lib/api";
import { Card } from "./Card";
import { domainDotClass } from "./DomainBadge";
import { t } from "../lib/i18n";

export function GoalInvestmentCard() {
  const [items, setItems] = useState<GoalTimeInvestment[] | null>(null);

  useEffect(() => {
    api.getGoalTimeInvestment(7).then(setItems);
  }, []);

  const maxMinutes = Math.max(1, ...(items ?? []).map((i) => i.scheduledMinutes));

  return (
    <Card>
      <h2 className="mb-4 text-sm font-medium text-slate-500">{t.dashboard.goalInvestmentTitle}</h2>
      {items === null ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-8 animate-pulse rounded-lg bg-slate-100" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-slate-400">{t.dashboard.goalInvestmentEmpty}</p>
      ) : (
        <div className="space-y-4">
          {items.map((i) => (
            <div key={i.goalId}>
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <Link
                  to={`/goals/${i.goalId}`}
                  className="min-w-0 truncate text-sm font-medium text-slate-700 hover:text-brand-700"
                >
                  {i.title}
                </Link>
                <span className="shrink-0 text-xs text-slate-500">
                  {i.scheduledMinutes} {t.common.minutesShort} · {Math.round(i.completionRate * 100)}% {t.dashboard.done}
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-slate-100">
                <div
                  className={`h-2 rounded-full ${domainDotClass(i.domain)}`}
                  style={{ width: `${(i.scheduledMinutes / maxMinutes) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
