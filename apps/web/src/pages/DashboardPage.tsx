import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Minus, TrendingDown, TrendingUp } from "lucide-react";
import type { EnergyState, PriorityReport } from "@productivityapp/core";
import { api } from "../lib/api";
import { BehindPaceBanner } from "../components/BehindPaceBanner";
import { Card } from "../components/Card";
import { GoalInvestmentCard } from "../components/GoalInvestmentCard";
import { LineChart } from "../components/LineChart";
import { MissedTasksBanner } from "../components/MissedTasksBanner";
import { NeglectedGoalsBanner } from "../components/NeglectedGoalsBanner";
import { NotificationToggle } from "../components/NotificationToggle";
import { PriorityCard } from "../components/PriorityCard";
import { TodayFocusCard } from "../components/TodayFocusCard";
import { formatShort } from "../lib/date";
import { t } from "../lib/i18n";

const TREND_META = {
  rising: { label: t.dashboard.trendRising, icon: TrendingUp, className: "text-emerald-600" },
  falling: { label: t.dashboard.trendFalling, icon: TrendingDown, className: "text-red-600" },
  stable: { label: t.dashboard.trendStable, icon: Minus, className: "text-slate-500" },
};

function EnergyCard({ energy }: { energy: EnergyState }) {
  const trend = TREND_META[energy.trend];
  return (
    <Card>
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-medium text-slate-500">{t.dashboard.energyToday}</h2>
        <span className={`inline-flex items-center gap-1 text-sm font-medium ${trend.className}`}>
          <trend.icon size={15} strokeWidth={2.5} />
          {trend.label}
        </span>
      </div>
      <div className="mt-2 flex items-end gap-3">
        <span className="font-display text-4xl font-bold tabular-nums text-slate-900">{energy.score}</span>
        <span className="pb-1 text-sm text-slate-400">/ 100</span>
      </div>
      <div className="mt-3 h-2 w-full rounded-full bg-slate-100">
        <div className="h-2 rounded-full bg-brand-600 transition-all" style={{ width: `${energy.score}%` }} />
      </div>
      <p className="mt-3 text-sm leading-relaxed text-slate-500">
        {t.dashboard.capacityScaled(Math.round(energy.loadMultiplier * 100))}
        {t.dashboard.capacitySuffix}
      </p>
      <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-slate-100 pt-4 text-xs text-slate-500">
        <div>
          <dt>{t.dashboard.completion7d}</dt>
          <dd className="mt-0.5 text-sm font-semibold text-slate-800">{Math.round(energy.signals.completionRate7d * 100)}%</dd>
        </div>
        <div>
          <dt>{t.dashboard.completion14d}</dt>
          <dd className="mt-0.5 text-sm font-semibold text-slate-800">{Math.round(energy.signals.completionRate14d * 100)}%</dd>
        </div>
        <div>
          <dt>{t.dashboard.missedStreak}</dt>
          <dd className="mt-0.5 text-sm font-semibold text-slate-800">
            {energy.signals.missedStreak} {t.dashboard.days}
          </dd>
        </div>
        <div>
          <dt>{t.dashboard.completedStreak}</dt>
          <dd className="mt-0.5 text-sm font-semibold text-slate-800">
            {energy.signals.completedStreak} {t.dashboard.days}
          </dd>
        </div>
      </dl>
    </Card>
  );
}

function TrendCard() {
  const [points, setPoints] = useState<{ date: string; score: number; completionRate: number | null }[] | null>(null);

  useEffect(() => {
    api.getEnergyTrend(30).then(setPoints);
  }, []);

  return (
    <Card>
      <h2 className="mb-4 text-sm font-medium text-slate-500">{t.dashboard.trendTitle}</h2>
      {points === null ? (
        <div className="h-[140px] animate-pulse rounded-lg bg-slate-100" />
      ) : (
        <LineChart points={points.map((p) => ({ label: formatShort(p.date), value: p.score }))} min={0} max={100} />
      )}
    </Card>
  );
}

export function DashboardPage() {
  const [energy, setEnergy] = useState<EnergyState | null>(null);
  const [priority, setPriority] = useState<PriorityReport | null>(null);
  const [loading, setLoading] = useState(true);

  function loadReports() {
    return Promise.all([api.getEnergy(), api.getPriority(7)]).then(([e, p]) => {
      setEnergy(e);
      setPriority(p);
    });
  }

  useEffect(() => {
    loadReports().finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {[0, 1].map((i) => (
          <div key={i} className="h-64 animate-pulse rounded-xl border border-slate-200/80 bg-white" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900">{t.dashboard.title}</h1>
        <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-500">
          <Link to="/calendar" className="font-medium text-brand-600 hover:text-brand-700">
            {t.dashboard.generateSchedule}
          </Link>
          <span>{t.dashboard.or}</span>
          <Link to="/goals" className="font-medium text-brand-600 hover:text-brand-700">
            {t.dashboard.addGoal}
          </Link>
          <span>{t.dashboard.getStarted}</span>
          <ArrowRight size={14} className="text-slate-300" />
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
          <Link to="/review" className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:text-brand-700">
            {t.dashboard.reviewLink}
            <ArrowRight size={14} />
          </Link>
          <Link to="/assistant" className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:text-brand-700">
            {t.dashboard.assistantLink}
            <ArrowRight size={14} />
          </Link>
        </div>
      </div>
      <MissedTasksBanner onRescheduled={loadReports} />
      <BehindPaceBanner />
      <NeglectedGoalsBanner />
      <TodayFocusCard />
      <NotificationToggle />
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {energy && <EnergyCard energy={energy} />}
        {priority && <PriorityCard report={priority} />}
      </div>
      <GoalInvestmentCard />
      <TrendCard />
    </div>
  );
}
