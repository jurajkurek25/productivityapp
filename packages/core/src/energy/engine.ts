import type { EnergyState, ISODate, TaskCompletionRecord } from "../domain/types.js";

/**
 * Energy/fatigue inference is deliberately isolated behind this interface.
 * The exact heuristic will need iteration (or eventually a learned model),
 * but nothing outside this module should need to change when it does —
 * callers only depend on `EnergyState`.
 */
export interface EnergyInferenceEngine {
  infer(history: TaskCompletionRecord[], asOfDate: ISODate): EnergyState;
}

function dayRatio(r: TaskCompletionRecord): number {
  if (r.scheduledCount === 0) return 1; // no load that day = neutral, not a strike
  return r.completedCount / r.scheduledCount;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function windowed(
  history: TaskCompletionRecord[],
  asOfDate: ISODate,
  days: number
): TaskCompletionRecord[] {
  const asOfMs = new Date(asOfDate + "T00:00:00Z").getTime();
  const startMs = asOfMs - (days - 1) * 86_400_000;
  return history
    .filter((r) => {
      const t = new Date(r.date + "T00:00:00Z").getTime();
      return t >= startMs && t <= asOfMs;
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}

function weightedCompletionRate(records: TaskCompletionRecord[]): number {
  const totalScheduled = records.reduce((s, r) => s + r.scheduledCount, 0);
  // No data yet (new user, or an idle stretch) reads as neutral, not "fully rested".
  if (totalScheduled === 0) return 0.6;
  const totalCompleted = records.reduce((s, r) => s + r.completedCount, 0);
  return totalCompleted / totalScheduled;
}

/** Consecutive most-recent days (walking backwards) whose ratio stays under `threshold`. */
function trailingStreak(
  records: TaskCompletionRecord[],
  predicate: (ratio: number, r: TaskCompletionRecord) => boolean
): number {
  let streak = 0;
  for (let i = records.length - 1; i >= 0; i--) {
    const r = records[i];
    if (r.scheduledCount === 0) continue; // idle days don't break or extend a streak
    if (predicate(dayRatio(r), r)) streak++;
    else break;
  }
  return streak;
}

export class HeuristicEnergyEngine implements EnergyInferenceEngine {
  infer(history: TaskCompletionRecord[], asOfDate: ISODate): EnergyState {
    const last7 = windowed(history, asOfDate, 7);
    const last14 = windowed(history, asOfDate, 14);

    const completionRate7d = weightedCompletionRate(last7);
    const completionRate14d = weightedCompletionRate(last14);

    const missedStreak = trailingStreak(last14, (ratio) => ratio < 0.34);
    const completedStreak = trailingStreak(last14, (ratio) => ratio >= 0.85);

    const scheduled7 = last7.reduce((s, r) => s + r.scheduledCount, 0);
    const missed7 = last7.reduce((s, r) => s + r.missedCount, 0);
    const overdueLoad = scheduled7 === 0 ? 0 : clamp(missed7 / scheduled7, 0, 1);

    const rawScore =
      40 +
      35 * completionRate7d +
      15 * completionRate14d -
      20 * overdueLoad -
      4 * Math.min(missedStreak, 7) +
      3 * Math.min(completedStreak, 5);
    const score = Math.round(clamp(rawScore, 0, 100));

    const recentHalf = last7.slice(Math.max(0, last7.length - 3));
    const priorHalf = last7.slice(0, Math.max(0, last7.length - 3));
    const recentAvg = weightedCompletionRate(recentHalf);
    const priorAvg = weightedCompletionRate(priorHalf);
    const delta = recentAvg - priorAvg;
    const trend = delta > 0.1 ? "rising" : delta < -0.1 ? "falling" : "stable";

    let loadMultiplier = clamp(0.5 + (score / 100) * 0.65, 0.5, 1.15);
    if (missedStreak >= 3) loadMultiplier = clamp(loadMultiplier * 0.85, 0.4, 1.15);
    loadMultiplier = Math.round(loadMultiplier * 100) / 100;

    return {
      date: asOfDate,
      score,
      trend,
      loadMultiplier,
      signals: {
        completionRate7d: Math.round(completionRate7d * 100) / 100,
        completionRate14d: Math.round(completionRate14d * 100) / 100,
        missedStreak,
        completedStreak,
        overdueLoad: Math.round(overdueLoad * 100) / 100,
      },
    };
  }
}

export const defaultEnergyEngine: EnergyInferenceEngine = new HeuristicEnergyEngine();
