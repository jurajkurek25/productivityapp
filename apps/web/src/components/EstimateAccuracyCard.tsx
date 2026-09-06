import { useEffect, useState } from "react";
import { api, type EstimateAccuracyDomain } from "../lib/api";
import { Card } from "./Card";
import { DomainBadge } from "./DomainBadge";
import { t } from "../lib/i18n";

const ACCURATE_THRESHOLD = 10;

export function EstimateAccuracyCard() {
  const [items, setItems] = useState<EstimateAccuracyDomain[] | null>(null);

  useEffect(() => {
    api.getEstimateAccuracy(90).then(setItems);
  }, []);

  return (
    <Card>
      <h2 className="mb-4 text-sm font-medium text-slate-500">{t.weeklyReview.estimateAccuracyTitle}</h2>
      {items === null ? (
        <div className="space-y-3">
          {[0, 1].map((i) => (
            <div key={i} className="h-12 animate-pulse rounded-lg bg-slate-100" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-slate-400">{t.weeklyReview.estimateAccuracyEmpty}</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {items.map((d) => {
            const accurate = Math.abs(d.biasPercent) <= ACCURATE_THRESHOLD;
            return (
              <li key={d.domain} className="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0 last:pb-0">
                <DomainBadge domain={d.domain} />
                <div className="text-right">
                  <p className={`text-sm font-medium ${accurate ? "text-slate-600" : "text-amber-700"}`}>
                    {accurate
                      ? t.weeklyReview.biasAccurate
                      : d.biasPercent > 0
                        ? t.weeklyReview.biasUnderestimate(d.biasPercent)
                        : t.weeklyReview.biasOverestimate(d.biasPercent)}
                  </p>
                  <p className="text-xs text-slate-400">{t.weeklyReview.sampleSizeLabel(d.sampleSize)}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
