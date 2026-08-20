import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { TrendingDown } from "lucide-react";
import { api, type BehindPaceGoal } from "../lib/api";
import { t } from "../lib/i18n";

export function BehindPaceBanner() {
  const [goals, setGoals] = useState<BehindPaceGoal[]>([]);

  useEffect(() => {
    api
      .getGoalsBehindPace()
      .then(setGoals)
      .catch(() => setGoals([]));
  }, []);

  if (goals.length === 0) return null;

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-card">
      <div className="flex items-center gap-2.5 text-sm text-amber-800">
        <TrendingDown size={18} strokeWidth={2.25} className="shrink-0" />
        <span>{t.dashboard.behindPaceBanner(goals.length)}</span>
      </div>
      <ul className="mt-2 space-y-1">
        {goals.map((g) => (
          <li key={g.goalId}>
            <Link to={`/goals/${g.goalId}`} className="text-sm font-medium text-amber-700 underline hover:text-amber-900">
              {t.dashboard.behindPaceGoal(g.title, g.daysRemaining)}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
