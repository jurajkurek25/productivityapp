import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Flame } from "lucide-react";
import type { PriorityReport } from "@productivityapp/core";
import { api, type WeeklyTargetGoal } from "../lib/api";
import { Card } from "../components/Card";
import { EstimateAccuracyCard } from "../components/EstimateAccuracyCard";
import { GoalInvestmentCard } from "../components/GoalInvestmentCard";
import { HabitStreaksCard } from "../components/HabitStreaksCard";
import { NeglectedGoalsBanner } from "../components/NeglectedGoalsBanner";
import { PriorityCard } from "../components/PriorityCard";
import { t } from "../lib/i18n";

function WeeklyTargetsCard() {
  const [items, setItems] = useState<WeeklyTargetGoal[] | null>(null);

  useEffect(() => {
    api.getGoalsWithWeeklyTargets().then(setItems);
  }, []);

  return (
    <Card>
      <h2 className="mb-4 text-sm font-medium text-slate-500">{t.weeklyReview.weeklyTargetsTitle}</h2>
      {items === null ? (
        <div className="space-y-3">
          {[0, 1].map((i) => (
            <div key={i} className="h-14 animate-pulse rounded-lg bg-slate-100" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-slate-400">{t.weeklyReview.weeklyTargetsEmpty}</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {items.map((g) => (
            <li key={g.goalId} className="py-3 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Link to={`/goals/${g.goalId}`} className="min-w-0 truncate text-sm font-medium text-slate-700 hover:text-brand-700">
                  {g.title}
                </Link>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${
                    g.weeklyTargetMet ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {g.weeklyTargetMet ? t.weeklyReview.met : t.weeklyReview.notMet}
                </span>
              </div>
              <div className="mt-1.5 flex items-center justify-between gap-2">
                <div className="h-1.5 w-full max-w-[60%] rounded-full bg-slate-100">
                  <div
                    className={`h-1.5 rounded-full ${g.weeklyTargetMet ? "bg-emerald-500" : "bg-brand-500"}`}
                    style={{ width: `${Math.min(100, (g.currentWeekMinutes / g.weeklyTargetMinutes) * 100)}%` }}
                  />
                </div>
                <span className="shrink-0 text-xs text-slate-400">
                  {g.currentWeekMinutes} / {g.weeklyTargetMinutes} {t.common.minutesShort}
                </span>
              </div>
              {g.weeklyTargetStreak > 0 && (
                <div className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-amber-600">
                  <Flame size={13} strokeWidth={2.25} />
                  {t.goalDetail.weeklyStreakLabel(g.weeklyTargetStreak)}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export function WeeklyReviewPage() {
  const [priority, setPriority] = useState<PriorityReport | null>(null);

  useEffect(() => {
    api.getPriority(7).then(setPriority);
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900">{t.weeklyReview.title}</h1>
        <p className="mt-1 text-sm text-slate-500">{t.weeklyReview.subtitle}</p>
      </div>
      <WeeklyTargetsCard />
      <HabitStreaksCard />
      <NeglectedGoalsBanner />
      <GoalInvestmentCard />
      <EstimateAccuracyCard />
      {priority && <PriorityCard report={priority} />}
    </div>
  );
}
