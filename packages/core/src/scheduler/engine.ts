import type {
  EnergyState,
  ISODate,
  LifeDomain,
  Step,
  TaskInstance,
  WeeklyCapacityTemplate,
} from "../domain/types.js";
import { expandOccurrences } from "./recurrence.js";

const DAY_MS = 86_400_000;
const MAX_LOOKAHEAD_DAYS = 7;

function toUTC(date: ISODate): number {
  return new Date(date + "T00:00:00Z").getTime();
}
function fromUTC(ms: number): ISODate {
  return new Date(ms).toISOString().slice(0, 10);
}
function weekdayOf(date: ISODate): number {
  return new Date(date + "T00:00:00Z").getUTCDay();
}
function addDays(date: ISODate, n: number): ISODate {
  return fromUTC(toUTC(date) + n * DAY_MS);
}

export interface SchedulerCandidate {
  step: Step;
  targetDate: ISODate;
  /** Set when this candidate is a missed task being re-injected. */
  rescheduledFrom?: ISODate;
}

export interface SchedulerInput {
  steps: Step[];
  /** Instances already on the calendar (any status) — used to avoid double-booking and to reserve capacity. */
  existingInstances: TaskInstance[];
  weeklyCapacity: WeeklyCapacityTemplate;
  energyByDate: (date: ISODate) => EnergyState;
  rangeStart: ISODate;
  rangeEnd: ISODate;
  /** Factory for new instance ids/timestamps, injected so the engine stays pure. */
  makeId: () => string;
  now: () => string;
}

export interface UnplacedCandidate {
  stepId: string;
  targetDate: ISODate;
  reason: "no-capacity-in-lookahead-window" | "past-range-end";
}

export interface SchedulerResult {
  placed: TaskInstance[];
  unplaced: UnplacedCandidate[];
}

function domainCapacityForDate(
  date: ISODate,
  weeklyCapacity: WeeklyCapacityTemplate,
  energy: EnergyState
): Record<LifeDomain, number> {
  const template = weeklyCapacity.days[weekdayOf(date)];
  const out = {} as Record<LifeDomain, number>;
  for (const domain of Object.keys(template) as LifeDomain[]) {
    out[domain] = Math.round(template[domain] * energy.loadMultiplier);
  }
  return out;
}

/**
 * Greedily places step occurrences onto the calendar within a date range,
 * respecting per-domain daily capacity that has already been scaled by the
 * day's inferred energy state (see `energy/engine.ts`). When a day is full,
 * the excess slides forward (up to MAX_LOOKAHEAD_DAYS) to the next day with
 * room — this is what keeps a low-energy day light without dropping work.
 */
export function scheduleRange(input: SchedulerInput): SchedulerResult {
  const {
    steps,
    existingInstances,
    weeklyCapacity,
    energyByDate,
    rangeStart,
    rangeEnd,
    makeId,
    now,
  } = input;

  const remainingByDate = new Map<ISODate, Record<LifeDomain, number>>();
  const usedKeys = new Set<string>(); // `${stepId}|${date}` already scheduled

  for (const inst of existingInstances) {
    usedKeys.add(`${inst.stepId}|${inst.scheduledDate}`);
    if (inst.status === "missed" || inst.status === "skipped") continue;
    if (inst.scheduledDate < rangeStart || inst.scheduledDate > rangeEnd) continue;
    if (!remainingByDate.has(inst.scheduledDate)) {
      remainingByDate.set(
        inst.scheduledDate,
        domainCapacityForDate(inst.scheduledDate, weeklyCapacity, energyByDate(inst.scheduledDate))
      );
    }
    const cap = remainingByDate.get(inst.scheduledDate)!;
    cap[inst.domain] = Math.max(0, cap[inst.domain] - inst.durationMinutes);
  }

  function capacityFor(date: ISODate): Record<LifeDomain, number> {
    if (!remainingByDate.has(date)) {
      remainingByDate.set(date, domainCapacityForDate(date, weeklyCapacity, energyByDate(date)));
    }
    return remainingByDate.get(date)!;
  }

  const candidates: SchedulerCandidate[] = [];
  for (const step of steps) {
    if (step.status === "archived" || step.status === "done") continue;
    const dates = expandOccurrences(step, rangeStart, rangeEnd);
    for (const d of dates) {
      if (usedKeys.has(`${step.id}|${d}`)) continue;
      candidates.push({ step, targetDate: d });
    }
  }

  candidates.sort((a, b) => {
    if (a.targetDate !== b.targetDate) return a.targetDate < b.targetDate ? -1 : 1;
    if (a.step.priority !== b.step.priority) return a.step.priority - b.step.priority;
    return a.step.estimatedMinutes - b.step.estimatedMinutes;
  });

  const placed: TaskInstance[] = [];
  const unplaced: UnplacedCandidate[] = [];

  for (const candidate of candidates) {
    const { step } = candidate;
    let placedOk = false;
    for (let offset = 0; offset <= MAX_LOOKAHEAD_DAYS; offset++) {
      const tryDate = addDays(candidate.targetDate, offset);
      if (tryDate > rangeEnd) break;
      const cap = capacityFor(tryDate);
      if (cap[step.domain] >= step.estimatedMinutes) {
        cap[step.domain] -= step.estimatedMinutes;
        const timestamp = now();
        placed.push({
          id: makeId(),
          workspaceId: step.workspaceId,
          stepId: step.id,
          goalId: step.goalId,
          domain: step.domain,
          title: step.title,
          scheduledDate: tryDate,
          durationMinutes: step.estimatedMinutes,
          status: "scheduled",
          rescheduledFrom: offset > 0 ? candidate.targetDate : candidate.rescheduledFrom,
          createdAt: timestamp,
          updatedAt: timestamp,
        });
        placedOk = true;
        break;
      }
    }
    if (!placedOk) {
      const reason =
        addDays(candidate.targetDate, MAX_LOOKAHEAD_DAYS) > rangeEnd
          ? "past-range-end"
          : "no-capacity-in-lookahead-window";
      unplaced.push({ stepId: step.id, targetDate: candidate.targetDate, reason });
    }
  }

  return { placed, unplaced };
}

/**
 * Re-injects instances that are past due and still `scheduled` (i.e. missed)
 * as fresh candidates starting from `fromDate`, then delegates to
 * `scheduleRange`. Missed work gets first crack at capacity ahead of
 * freshly-due recurring items because the caller should run this before
 * generating the rest of the range.
 */
export function reflowMissed(
  missedInstances: TaskInstance[],
  stepsById: Map<string, Step>,
  fromDate: ISODate
): Step[] {
  // Represent each missed instance as a one-off "catch up" step so it flows
  // through the same capacity-aware placement logic as everything else.
  return missedInstances
    .map((inst) => stepsById.get(inst.stepId))
    .filter((s): s is Step => !!s)
    .map((step) => ({
      ...step,
      recurrence: { freq: "once" as const },
      earliestDate: fromDate,
      priority: Math.max(1, step.priority - 1),
    }));
}
