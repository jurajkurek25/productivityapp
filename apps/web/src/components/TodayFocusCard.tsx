import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { FocusQuadrant, TodayFocusItem } from "../lib/api";
import { api } from "../lib/api";
import { Card } from "./Card";
import { DomainBadge } from "./DomainBadge";
import { t } from "../lib/i18n";

const QUADRANT_ORDER: FocusQuadrant[] = ["do_now", "protect_time", "quick_win", "reconsider"];

const QUADRANT_LABEL: Record<FocusQuadrant, string> = {
  do_now: t.todayFocus.doNow,
  protect_time: t.todayFocus.protectTime,
  quick_win: t.todayFocus.quickWin,
  reconsider: t.todayFocus.reconsider,
};

const QUADRANT_CLASS: Record<FocusQuadrant, string> = {
  do_now: "border-red-200 bg-red-50 text-red-700",
  protect_time: "border-brand-200 bg-brand-50 text-brand-700",
  quick_win: "border-amber-200 bg-amber-50 text-amber-700",
  reconsider: "border-slate-200 bg-slate-50 text-slate-500",
};

export function TodayFocusCard() {
  const [items, setItems] = useState<TodayFocusItem[] | null>(null);

  useEffect(() => {
    api.getTodayFocus().then(setItems);
  }, []);

  if (items !== null && items.length === 0) return null;

  return (
    <Card>
      <h2 className="mb-4 text-sm font-medium text-slate-500">{t.todayFocus.title}</h2>
      {items === null ? (
        <div className="space-y-3">
          {[0, 1].map((i) => (
            <div key={i} className="h-10 animate-pulse rounded-lg bg-slate-100" />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {QUADRANT_ORDER.filter((q) => items.some((i) => i.quadrant === q)).map((quadrant) => (
            <div key={quadrant}>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
                {QUADRANT_LABEL[quadrant]}
              </p>
              <ul className="space-y-1.5">
                {items
                  .filter((i) => i.quadrant === quadrant)
                  .map((i) => (
                    <li
                      key={i.instanceId}
                      className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm ${QUADRANT_CLASS[quadrant]}`}
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <DomainBadge domain={i.domain} />
                        <Link to={`/goals/${i.goalId}`} className="truncate font-medium hover:underline">
                          {i.title}
                        </Link>
                      </div>
                      <span className="shrink-0 text-xs">
                        {i.durationMinutes} {t.common.minutesShort}
                      </span>
                    </li>
                  ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
