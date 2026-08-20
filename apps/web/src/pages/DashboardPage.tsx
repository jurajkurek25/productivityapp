import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { EnergyState, PriorityReport } from "@productivityapp/core";
import { api } from "../lib/api";
import { DomainBadge, domainDotClass } from "../components/DomainBadge";

function EnergyCard({ energy }: { energy: EnergyState }) {
  const trendLabel = { rising: "Rising", falling: "Falling", stable: "Stable" }[energy.trend];
  const trendColor = { rising: "text-emerald-600", falling: "text-red-600", stable: "text-slate-500" }[energy.trend];

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-medium text-slate-500">Inferred energy today</h2>
        <span className={`text-sm font-medium ${trendColor}`}>{trendLabel}</span>
      </div>
      <div className="mt-2 flex items-end gap-3">
        <span className="text-4xl font-semibold tabular-nums">{energy.score}</span>
        <span className="pb-1 text-sm text-slate-400">/ 100</span>
      </div>
      <div className="mt-3 h-2 w-full rounded-full bg-slate-100">
        <div
          className="h-2 rounded-full bg-slate-900 transition-all"
          style={{ width: `${energy.score}%` }}
        />
      </div>
      <p className="mt-3 text-sm text-slate-500">
        Scheduling capacity today is scaled to{" "}
        <span className="font-medium text-slate-700">{Math.round(energy.loadMultiplier * 100)}%</span> of normal,
        based on your recent completion history — not a self-report.
      </p>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-xs text-slate-500">
        <div>
          <dt>7-day completion</dt>
          <dd className="text-sm font-medium text-slate-700">{Math.round(energy.signals.completionRate7d * 100)}%</dd>
        </div>
        <div>
          <dt>14-day completion</dt>
          <dd className="text-sm font-medium text-slate-700">{Math.round(energy.signals.completionRate14d * 100)}%</dd>
        </div>
        <div>
          <dt>Missed streak</dt>
          <dd className="text-sm font-medium text-slate-700">{energy.signals.missedStreak} days</dd>
        </div>
        <div>
          <dt>Completed streak</dt>
          <dd className="text-sm font-medium text-slate-700">{energy.signals.completedStreak} days</dd>
        </div>
      </dl>
    </div>
  );
}

function PriorityCard({ report }: { report: PriorityReport }) {
  const maxMinutes = Math.max(1, ...report.domains.map((d) => d.scheduledMinutes));
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6">
      <h2 className="mb-4 text-sm font-medium text-slate-500">Balance across domains (last 7 days)</h2>
      <div className="space-y-3">
        {report.domains.map((d) => (
          <div key={d.domain}>
            <div className="mb-1 flex items-center justify-between">
              <DomainBadge domain={d.domain} />
              <span className="text-xs text-slate-500">
                {d.scheduledMinutes}m scheduled · {Math.round(d.completionRate * 100)}% done
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
        <p className="mt-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Neglected: {report.neglectedDomains.join(", ")}. Consider adding a goal or step there.
        </p>
      )}
    </div>
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

  if (loading) return <div className="text-slate-400">Loading…</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-slate-500">
          <Link to="/calendar" className="underline">
            Generate today's schedule
          </Link>{" "}
          or{" "}
          <Link to="/goals" className="underline">
            add a goal
          </Link>{" "}
          to get started.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {energy && <EnergyCard energy={energy} />}
        {priority && <PriorityCard report={priority} />}
      </div>
    </div>
  );
}
