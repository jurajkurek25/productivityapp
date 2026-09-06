import { prisma } from "./prisma.js";
import type { LifeDomain, RecurrenceFrequency } from "@productivityapp/core";

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Consecutive completed occurrences counting back from the most recent past
 * one. Today's not-yet-actioned occurrence (status "scheduled") is skipped
 * rather than breaking the streak — the day isn't over yet. Any other
 * non-completed occurrence (missed, skipped, or an overdue "scheduled" one)
 * ends the streak.
 */
function countStreak(instances: { scheduledDate: string; status: string }[], today: string): number {
  let streak = 0;
  for (const inst of instances) {
    if (inst.scheduledDate === today && inst.status === "scheduled") continue;
    if (inst.status === "completed") {
      streak++;
      continue;
    }
    break;
  }
  return streak;
}

export interface StepStreak {
  stepId: string;
  goalId: string;
  title: string;
  domain: LifeDomain;
  freq: RecurrenceFrequency;
  streak: number;
}

export async function computeStepStreak(workspaceId: string, stepId: string): Promise<number> {
  const today = todayISO();
  const instances = await prisma.taskInstance.findMany({
    where: { workspaceId, stepId, scheduledDate: { lte: today } },
    orderBy: { scheduledDate: "desc" },
    select: { scheduledDate: true, status: true },
  });
  return countStreak(instances, today);
}

/** Every active recurring (habit-style) step across the workspace with its current streak — the personal-consistency counterpart to the goal-level weekly-target streak. */
export async function listStepStreaks(workspaceId: string): Promise<StepStreak[]> {
  const steps = await prisma.step.findMany({
    where: { workspaceId, status: "active", recurrenceFreq: { not: "once" } },
  });

  const results: StepStreak[] = [];
  for (const step of steps) {
    results.push({
      stepId: step.id,
      goalId: step.goalId,
      title: step.title,
      domain: step.domain as LifeDomain,
      freq: step.recurrenceFreq as RecurrenceFrequency,
      streak: await computeStepStreak(workspaceId, step.id),
    });
  }
  return results.sort((a, b) => b.streak - a.streak);
}
