import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ArrowRight, Minus, TrendingDown, TrendingUp } from "lucide-react";
import type { EnergyState, PriorityReport } from "@productivityapp/core";
import { api } from "../lib/api";
import { Card } from "../components/Card";
import { DomainBadge, domainDotClass } from "../components/DomainBadge";

const TREND_META = {
  rising: { label: "Rising", icon: TrendingUp, className: "text-emerald-600" },
  falling: { label: "Falling", icon: TrendingDown, className: "text-red-600" },
  stable: { label: "Stable", icon: Minus, className: "text-slate-500" },
};

function EnergyCard({ energy }: { energy: EnergyState }) {
  const trend = TREND_META[energy.trend];
  return (
    <Card>
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-medium text-slate-500">Inferred energy today</h2>
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
        Scheduling capacity today is scaled to{" "}
        <span className="font-medium text-slate-700">{Math.round(energy.loadMultiplier * 100)}%</span> of normal,
        based on your recent completion history — not a self-report.
      </p>
      <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-slate-100 pt-4 text-xs text-slate-500">
        <div>
          <dt>7-day completion</dt>
          <dd className="mt-0.5 text-sm font-semibold text-slate-800">{Math.round(energy.signals.completionRate7d * 100)}%</dd>
        </div>
        <div>
          <dt>14-day completion</dt>
          <dd className="mt-0.5 text-sm font-semibold text-slate-800">{Math.round(energy.signals.completionRate14d * 100)}%</dd>
        </div>
        <div>
          <dt>Missed streak</dt>
          <dd className="mt-0.5 text-sm font-semibold text-slate-800">{energy.signals.missedStreak} days</dd>
        </div>
        <div>
          <dt>Completed streak</dt>
          <dd className="mt-0.5 text-sm font-semibold text-slate-800">{energy.signals.completedStreak} days</dd>
        </div>
      </dl>
    </Card>
  );
}

function PriorityCard({ report }: { report: PriorityReport }) {
  const maxMinutes = Math.max(1, ...report.domains.map((d) => d.scheduledMinutes));
  return (
    <Card>
      <h2 className="mb-4 text-sm font-medium text-slate-500">Balance across domains (last 7 days)</h2>
      <div className="space-y-4">
        {report.domains.map((d) => (
          <div key={d.domain}>
            <div className="mb-1.5 flex items-center justify-between">
              <DomainBadge domain={d.domain} />
              <span className="text-xs text-slate-500">
                {d.scheduledMinutes}m · {Math.round(d.completionRate * 100)}% done
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-slate-100">
              <div
                className={`h-2 rounded-full ${domainDotClass(d.domain)}`}
                style={{ width: `${(d.scheduledMinutes / maxMinutes) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
      {report.neglectedDomains.length > 0 && (
        <div className="mt-5 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
          <AlertTriangle size={16} strokeWidth={2.25} className="mt-0.5 shrink-0" />
          <span>Neglected: {report.neglectedDomains.join(", ")}. Consider adding a goal or step there.</span>
        </div>
      )}
    </Card>
  );
}

export function DashboardPage() {
  const [energy, setEnergy] = useState<EnergyState | null>(null);
  const [priority, setPriority] = useState<PriorityReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.getEnergy(), api.getPriority(7)])
      .then(([e, p]) => {
        setEnergy(e);
        setPriority(p);
      })
      .finally(() => setLoading(false));
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
        <h1 className="font-display text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-500">
          <Link to="/calendar" className="font-medium text-brand-600 hover:text-brand-700">
            Generate today's schedule
          </Link>
          <span>or</span>
          <Link to="/goals" className="font-medium text-brand-600 hover:text-brand-700">
            add a goal
          </Link>
          <span>to get started.</span>
          <ArrowRight size={14} className="text-slate-300" />
        </p>
      </div>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {energy && <EnergyCard energy={energy} />}
        {priority && <PriorityCard report={priority} />}
      </div>
    </div>
  );
}
