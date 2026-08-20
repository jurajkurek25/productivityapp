import type { ISODate, StudyMaterialItem, StudyPlan, StudyPlanDay } from "../domain/types.js";

const DAY_MS = 86_400_000;

function toUTC(date: ISODate): number {
  return new Date(date + "T00:00:00Z").getTime();
}
function fromUTC(ms: number): ISODate {
  return new Date(ms).toISOString().slice(0, 10);
}

function datesBetween(start: ISODate, endExclusive: ISODate): ISODate[] {
  const out: ISODate[] = [];
  for (let t = toUTC(start); t < toUTC(endExclusive); t += DAY_MS) out.push(fromUTC(t));
  return out;
}

export interface BuildStudyPlanOptions {
  goalId: string;
  materials: StudyMaterialItem[];
  examDate: ISODate;
  startDate: ISODate;
  /** Minutes of study capacity available on a given date. Defaults to a flat 60/day. */
  dailyCapacityMinutes?: (date: ISODate) => number;
  /** Max minutes of a single material to schedule per day, forcing interleaving instead of one topic hogging a day. */
  maxChunkMinutes?: number;
  /** How many of the final days before the exam get a review pass of the hardest topics. */
  reviewDays?: number;
}

/**
 * Splits study material into a day-by-day plan leading up to an exam date.
 * Harder topics (higher `difficulty`) are prioritized earlier and are the
 * ones re-surfaced in the review pass just before the exam. Output feeds
 * into the same scheduler as any other goal's steps — study is not a silo.
 */
export function buildStudyPlan(options: BuildStudyPlanOptions): StudyPlan {
  const {
    goalId,
    materials,
    examDate,
    startDate,
    dailyCapacityMinutes = () => 60,
    reviewDays = 2,
  } = options;

  const studyDates = datesBetween(startDate, examDate); // excludes exam day itself
  const remaining = new Map(materials.map((m) => [m.id, m.estimatedMinutes]));
  const byId = new Map(materials.map((m) => [m.id, m]));
  const maxChunkMinutes =
    options.maxChunkMinutes ?? Math.max(20, Math.ceil(dailyCapacityMinutes(startDate) / 3));

  const days: StudyPlanDay[] = [];

  if (studyDates.length === 0) {
    // Exam is today or in the past relative to startDate: cram everything onto startDate.
    const items = materials
      .filter((m) => m.estimatedMinutes > 0)
      .sort((a, b) => b.difficulty - a.difficulty)
      .map((m) => ({ materialId: m.id, title: m.title, minutes: m.estimatedMinutes, isReview: false }));
    return {
      goalId,
      examDate,
      days: [
        {
          date: startDate,
          items,
          totalMinutes: items.reduce((s, i) => s + i.minutes, 0),
        },
      ],
    };
  }

  for (const date of studyDates) {
    let capacityLeft = dailyCapacityMinutes(date);
    const items: StudyPlanDay["items"] = [];

    while (capacityLeft > 0) {
      const active = [...remaining.entries()]
        .filter(([, min]) => min > 0)
        .sort((a, b) => {
          const diffA = byId.get(a[0])!.difficulty;
          const diffB = byId.get(b[0])!.difficulty;
          if (diffA !== diffB) return diffB - diffA;
          return b[1] - a[1];
        });
      if (active.length === 0) break;

      let assignedThisPass = false;
      for (const [materialId, min] of active) {
        if (capacityLeft <= 0) break;
        const chunk = Math.min(min, capacityLeft, maxChunkMinutes);
        if (chunk <= 0) continue;
        remaining.set(materialId, min - chunk);
        capacityLeft -= chunk;
        assignedThisPass = true;
        const existing = items.find((i) => i.materialId === materialId && !i.isReview);
        if (existing) existing.minutes += chunk;
        else items.push({ materialId, title: byId.get(materialId)!.title, minutes: chunk, isReview: false });
      }
      if (!assignedThisPass) break;
    }

    days.push({ date, items, totalMinutes: items.reduce((s, i) => s + i.minutes, 0) });
  }

  // Anything that didn't fit gets crammed onto the last study day so no
  // material is silently dropped from the plan.
  const leftover = [...remaining.entries()].filter(([, min]) => min > 0);
  if (leftover.length > 0 && days.length > 0) {
    const lastDay = days[days.length - 1];
    for (const [materialId, min] of leftover) {
      lastDay.items.push({ materialId, title: byId.get(materialId)!.title, minutes: min, isReview: false });
      lastDay.totalMinutes += min;
      remaining.set(materialId, 0);
    }
  }

  // Review pass: on the final `reviewDays`, resurface the hardest topics
  // using any capacity left over on that day.
  const hardest = [...materials].sort((a, b) => b.difficulty - a.difficulty).slice(0, 3);
  const reviewTargetDays = days.slice(Math.max(0, days.length - reviewDays));
  for (const day of reviewTargetDays) {
    let capacityLeft = Math.max(0, dailyCapacityMinutes(day.date) - day.totalMinutes);
    for (const material of hardest) {
      if (capacityLeft <= 0) break;
      const chunk = Math.min(20, capacityLeft);
      day.items.push({ materialId: material.id, title: material.title, minutes: chunk, isReview: true });
      day.totalMinutes += chunk;
      capacityLeft -= chunk;
    }
  }

  return { goalId, examDate, days };
}
