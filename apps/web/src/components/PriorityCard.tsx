import { AlertTriangle } from "lucide-react";
import type { PriorityReport } from "@productivityapp/core";
import { Card } from "./Card";
import { DomainBadge, domainDotClass } from "./DomainBadge";
import { domainLabels, t } from "../lib/i18n";

export function PriorityCard({ report }: { report: PriorityReport }) {
  const maxMinutes = Math.max(1, ...report.domains.map((d) => d.scheduledMinutes));
  return (
    <Card>
      <h2 className="mb-4 text-sm font-medium text-slate-500">{t.dashboard.balanceTitle}</h2>
      <div className="space-y-4">
        {report.domains.map((d) => (
          <div key={d.domain}>
            <div className="mb-1.5 flex items-center justify-between">
              <DomainBadge domain={d.domain} />
              <span className="text-xs text-slate-500">
                {d.scheduledMinutes} {t.common.minutesShort} · {Math.round(d.completionRate * 100)}% {t.dashboard.done}
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
          <span>{t.dashboard.neglected(report.neglectedDomains.map((d) => domainLabels[d]).join(", "))}</span>
        </div>
      )}
    </Card>
  );
}
