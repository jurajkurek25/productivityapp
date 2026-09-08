import { LIFE_DOMAINS, type DomainBalanceEntry, type ISODate, type PriorityReport, type TaskInstance } from "../domain/types.js";

export interface ComputeDomainBalanceOptions {
  instances: TaskInstance[];
  windowStart: ISODate;
  windowEnd: ISODate;
  /** A domain with a share of total scheduled time below this fraction is flagged neglected. Default 10%. */
  neglectShareThreshold?: number;
  /** A domain with zero scheduled minutes in the window is always flagged neglected regardless of threshold. */
}

/**
 * Cross-domain balance for a rolling window: how much time each life domain
 * got, and how much of it was actually completed. Surfaces domains that are
 * being neglected relative to the others, not just in absolute terms.
 */
export function computeDomainBalance(options: ComputeDomainBalanceOptions): PriorityReport {
  const { instances, windowStart, windowEnd, neglectShareThreshold = 0.1 } = options;

  const inWindow = instances.filter(
    (i) => i.scheduledDate >= windowStart && i.scheduledDate <= windowEnd
  );

  const totals = new Map<string, { scheduled: number; completed: number }>();
  for (const domain of LIFE_DOMAINS) totals.set(domain, { scheduled: 0, completed: 0 });

  let grandTotalScheduled = 0;
  for (const inst of inWindow) {
    const bucket = totals.get(inst.domain)!;
    bucket.scheduled += inst.durationMinutes;
    grandTotalScheduled += inst.durationMinutes;
    if (inst.status === "completed") bucket.completed += inst.durationMinutes;
  }

  const domains: DomainBalanceEntry[] = LIFE_DOMAINS.map((domain) => {
    const bucket = totals.get(domain)!;
    const shareOfTotal = grandTotalScheduled === 0 ? 0 : bucket.scheduled / grandTotalScheduled;
    const completionRate = bucket.scheduled === 0 ? 0 : bucket.completed / bucket.scheduled;
    const neglected = bucket.scheduled === 0 || shareOfTotal < neglectShareThreshold;
    return {
      domain,
      scheduledMinutes: bucket.scheduled,
      completedMinutes: bucket.completed,
      completionRate: Math.round(completionRate * 100) / 100,
      shareOfTotal: Math.round(shareOfTotal * 100) / 100,
      neglected,
    };
  });

  return {
    windowStart,
    windowEnd,
    domains,
    neglectedDomains: domains.filter((d) => d.neglected).map((d) => d.domain),
  };
}
