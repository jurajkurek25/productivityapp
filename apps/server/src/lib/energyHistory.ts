import type { TaskCompletionRecord } from "@productivityapp/core";
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
