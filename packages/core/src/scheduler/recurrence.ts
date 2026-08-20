import type { ISODate, RecurrenceRule, Step } from "../domain/types.js";

const DAY_MS = 86_400_000;

function toUTC(date: ISODate): number {
  return new Date(date + "T00:00:00Z").getTime();
}

function fromUTC(ms: number): ISODate {
  return new Date(ms).toISOString().slice(0, 10);
}

function weekdayOf(date: ISODate): number {
  return new Date(date + "T00:00:00Z").getUTCDay();
}

function addMonthsUTC(date: ISODate, months: number): ISODate {
  const d = new Date(date + "T00:00:00Z");
  const day = d.getUTCDate();
  d.setUTCMonth(d.getUTCMonth() + months);
  // handle month-length overflow (e.g. Jan 31 + 1 month)
  if (d.getUTCDate() !== day) d.setUTCDate(0);
  return d.toISOString().slice(0, 10);
}

/**
 * Expands a step's recurrence rule into concrete calendar dates within
 * [rangeStart, rangeEnd] (inclusive). Does not know about capacity or
 * existing placements — that's the scheduler's job.
 */
export function expandOccurrences(
  step: Pick<Step, "earliestDate" | "recurrence" | "createdAt">,
  rangeStart: ISODate,
  rangeEnd: ISODate
): ISODate[] {
  const rule: RecurrenceRule = step.recurrence;
  const anchor = step.earliestDate ?? step.createdAt.slice(0, 10);
  const effectiveStart = anchor > rangeStart ? anchor : rangeStart;
  const untilCap = rule.until && rule.until < rangeEnd ? rule.until : rangeEnd;
  if (effectiveStart > untilCap) return [];

  const interval = Math.max(1, rule.interval ?? 1);
  const dates: ISODate[] = [];

  if (rule.freq === "once") {
    if (anchor >= rangeStart && anchor <= untilCap) dates.push(anchor);
    return dates;
  }

  if (rule.freq === "daily") {
    let cursor = toUTC(anchor);
    const endMs = toUTC(untilCap);
    const startMs = toUTC(effectiveStart);
    // align cursor to the anchor's cadence, then clip to range
    while (cursor < startMs) cursor += interval * DAY_MS;
    for (let t = cursor; t <= endMs; t += interval * DAY_MS) {
      const d = fromUTC(t);
      if (!rule.daysOfWeek || rule.daysOfWeek.includes(weekdayOf(d))) {
        dates.push(d);
      }
    }
    return dates;
  }

  if (rule.freq === "weekly") {
    const days = rule.daysOfWeek && rule.daysOfWeek.length > 0 ? rule.daysOfWeek : [weekdayOf(anchor)];
    const anchorWeekStart = toUTC(anchor) - weekdayOf(anchor) * DAY_MS;
    const endMs = toUTC(untilCap);
    for (let weekStart = anchorWeekStart; weekStart <= endMs; weekStart += 7 * interval * DAY_MS) {
      for (const dow of days) {
        const t = weekStart + dow * DAY_MS;
        if (t < toUTC(effectiveStart) || t > endMs) continue;
        dates.push(fromUTC(t));
      }
    }
    return dates.sort();
  }

  if (rule.freq === "monthly") {
    let cursor = anchor;
    let guard = 0;
    while (cursor <= untilCap && guard < 240) {
      if (cursor >= effectiveStart) dates.push(cursor);
      cursor = addMonthsUTC(cursor, interval);
      guard++;
    }
    return dates;
  }

  return dates;
}
