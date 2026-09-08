import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Moon } from "lucide-react";
import { api, type NeglectedGoal } from "../lib/api";
import { t } from "../lib/i18n";

export function NeglectedGoalsBanner() {
  const [goals, setGoals] = useState<NeglectedGoal[]>([]);

  useEffect(() => {
    api
      .getNeglectedGoals(14)
      .then(setGoals)
      .catch(() => setGoals([]));
  }, []);

  if (goals.length === 0) return null;

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 shadow-card">
      <div className="flex items-center gap-2.5 text-sm text-slate-600">
        <Moon size={18} strokeWidth={2.25} className="shrink-0" />
        <span>{t.dashboard.neglectedGoalsBanner(goals.length)}</span>
      </div>
      <ul className="mt-2 space-y-1">
        {goals.map((g) => (
          <li key={g.goalId}>
            <Link to={`/goals/${g.goalId}`} className="text-sm font-medium text-slate-600 underline hover:text-slate-900">
              {g.daysSinceLastActivity === null
                ? t.dashboard.neglectedGoalNoActivity(g.title)
                : t.dashboard.neglectedGoalDaysAgo(g.title, g.daysSinceLastActivity)}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
