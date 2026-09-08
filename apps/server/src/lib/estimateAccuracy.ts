import { prisma } from "./prisma.js";
import type { LifeDomain } from "@productivityapp/core";

const MIN_SAMPLE_SIZE = 3;

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDays(date: string, n: number): string {
  return new Date(new Date(date + "T00:00:00Z").getTime() + n * 86_400_000).toISOString().slice(0, 10);
}

export interface EstimateAccuracyDomain {
  domain: LifeDomain;
  sampleSize: number;
  estimatedMinutesTotal: number;
  actualMinutesTotal: number;
  /** (actual/estimated - 1) * 100 — positive means tasks take longer than estimated. */
  biasPercent: number;
}

/**
 * Compares each completed task's actual duration against its step's
 * estimatedMinutes, aggregated by domain — a purely data-driven calibration
 * signal (same "no self-rating" principle as the rest of the app), not a
 * self-assessment. Domains with too few completed instances are omitted so a
 * single lucky/unlucky task doesn't produce a misleading percentage.
 */
export async function computeEstimateAccuracy(workspaceId: string, windowDays = 90): Promise<EstimateAccuracyDomain[]> {
  const windowStart = addDays(todayISO(), -windowDays);
  const instances = await prisma.taskInstance.findMany({
    where: { workspaceId, status: "completed", scheduledDate: { gte: windowStart } },
    select: { domain: true, durationMinutes: true, step: { select: { estimatedMinutes: true } } },
  });

  const byDomain = new Map<string, { estimatedTotal: number; actualTotal: number; count: number }>();
  for (const inst of instances) {
    const bucket = byDomain.get(inst.domain) ?? { estimatedTotal: 0, actualTotal: 0, count: 0 };
    bucket.estimatedTotal += inst.step.estimatedMinutes;
    bucket.actualTotal += inst.durationMinutes;
    bucket.count += 1;
    byDomain.set(inst.domain, bucket);
  }

  const results: EstimateAccuracyDomain[] = [];
  for (const [domain, b] of byDomain) {
    if (b.count < MIN_SAMPLE_SIZE || b.estimatedTotal === 0) continue;
    results.push({
      domain: domain as LifeDomain,
      sampleSize: b.count,
      estimatedMinutesTotal: b.estimatedTotal,
      actualMinutesTotal: b.actualTotal,
      biasPercent: Math.round((b.actualTotal / b.estimatedTotal - 1) * 100),
    });
  }
  return results.sort((a, b) => Math.abs(b.biasPercent) - Math.abs(a.biasPercent));
}
