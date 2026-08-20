import type { TaskCompletionRecord } from "@productivityapp/core";
import { defaultEnergyEngine } from "@productivityapp/core";
import { prisma } from "./prisma.js";

const DAY_MS = 86_400_000;

function addDays(date: string, n: number): string {
  const t = new Date(date + "T00:00:00Z").getTime() + n * DAY_MS;
  return new Date(t).toISOString().slice(0, 10);
}

/**
 * Builds the per-day completion history the energy engine needs, derived
 * straight from TaskInstance rows. An instance still marked `scheduled`
 * whose date is in the past (and no completion job has flipped it yet) is
 * treated as missed for this aggregation only — we don't mutate the row.
 */
export async function buildCompletionHistory(
  workspaceId: string,
  asOfDate: string,
  lookbackDays = 21
): Promise<TaskCompletionRecord[]> {
  const windowStart = addDays(asOfDate, -lookbackDays);
  const rows = await prisma.taskInstance.findMany({
    where: {
      workspaceId,
      scheduledDate: { gte: windowStart, lte: asOfDate },
    },
    select: { scheduledDate: true, status: true, durationMinutes: true },
  });

  const byDate = new Map<string, TaskCompletionRecord>();
  for (const row of rows) {
    if (!byDate.has(row.scheduledDate)) {
      byDate.set(row.scheduledDate, {
        date: row.scheduledDate,
        scheduledCount: 0,
        completedCount: 0,
        missedCount: 0,
        scheduledMinutes: 0,
        completedMinutes: 0,
      });
    }
    const bucket = byDate.get(row.scheduledDate)!;
    bucket.scheduledCount += 1;
    bucket.scheduledMinutes += row.durationMinutes;

    const isPast = row.scheduledDate < asOfDate;
    const effectiveStatus = row.status === "scheduled" && isPast ? "missed" : row.status;

    if (effectiveStatus === "completed") {
      bucket.completedCount += 1;
      bucket.completedMinutes += row.durationMinutes;
    } else if (effectiveStatus === "missed") {
      bucket.missedCount += 1;
    }
  }

  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

interface RawDayBucket {
  scheduledCount: number;
  scheduledMinutes: number;
  completedCount: number;
  completedMinutes: number;
  missedCount: number;
  /** Still "scheduled" in the DB — counts as missed once its date is in the past relative to whichever day we're scoring. */
  stillScheduledCount: number;
}

export interface EnergyTrendPoint {
  date: string;
  score: number;
  /** Same-day completion rate (completed / scheduled), or null if nothing was scheduled that day. */
  completionRate: number | null;
}

/**
 * Energy score + completion rate for each of the last `days` days, computed
 * from a single DB fetch instead of one query per day. A task instance
 * still "scheduled" counts as missed once its own date is in the past
 * relative to the day being scored — same rule buildCompletionHistory
 * applies for a single asOfDate, just precomputed once and reused per day.
 */
export async function buildEnergyTrend(
  workspaceId: string,
  days = 30,
  lookbackDays = 21
): Promise<EnergyTrendPoint[]> {
  const today = new Date().toISOString().slice(0, 10);
  const trendStart = addDays(today, -(days - 1));
  const fetchStart = addDays(trendStart, -lookbackDays);

  const rows = await prisma.taskInstance.findMany({
    where: { workspaceId, scheduledDate: { gte: fetchStart, lte: today } },
    select: { scheduledDate: true, status: true, durationMinutes: true },
  });

  const byDate = new Map<string, RawDayBucket>();
  for (const row of rows) {
    if (!byDate.has(row.scheduledDate)) {
      byDate.set(row.scheduledDate, {
        scheduledCount: 0,
        scheduledMinutes: 0,
        completedCount: 0,
        completedMinutes: 0,
        missedCount: 0,
        stillScheduledCount: 0,
      });
    }
    const bucket = byDate.get(row.scheduledDate)!;
    bucket.scheduledCount += 1;
    bucket.scheduledMinutes += row.durationMinutes;
    if (row.status === "completed") {
      bucket.completedCount += 1;
      bucket.completedMinutes += row.durationMinutes;
    } else if (row.status === "missed") {
      bucket.missedCount += 1;
    } else if (row.status === "scheduled") {
      bucket.stillScheduledCount += 1;
    }
  }

  const points: EnergyTrendPoint[] = [];
  for (let i = 0; i < days; i++) {
    const asOfDate = addDays(trendStart, i);
    const windowStart = addDays(asOfDate, -lookbackDays);

    const history: TaskCompletionRecord[] = [];
    for (const [date, bucket] of byDate) {
      if (date < windowStart || date > asOfDate) continue;
      const isPast = date < asOfDate;
      history.push({
        date,
        scheduledCount: bucket.scheduledCount,
        completedCount: bucket.completedCount,
        missedCount: bucket.missedCount + (isPast ? bucket.stillScheduledCount : 0),
        scheduledMinutes: bucket.scheduledMinutes,
        completedMinutes: bucket.completedMinutes,
      });
    }
    history.sort((a, b) => a.date.localeCompare(b.date));

    const state = defaultEnergyEngine.infer(history, asOfDate);
    const ownBucket = byDate.get(asOfDate);
    const completionRate =
      ownBucket && ownBucket.scheduledCount > 0 ? ownBucket.completedCount / ownBucket.scheduledCount : null;

    points.push({ date: asOfDate, score: state.score, completionRate });
  }

  return points;
}
