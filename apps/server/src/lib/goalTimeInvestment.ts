import type { GoalStatus, LifeDomain } from "@productivityapp/core";
import { prisma } from "./prisma.js";

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDays(date: string, n: number): string {
  return new Date(new Date(date + "T00:00:00Z").getTime() + n * 86_400_000).toISOString().slice(0, 10);
}

export interface GoalTimeInvestment {
  goalId: string;
  title: string;
  domain: LifeDomain;
  status: GoalStatus;
  scheduledMinutes: number;
  completedMinutes: number;
  completionRate: number;
}

/**
 * Per-goal breakdown of scheduled/completed minutes over a trailing
 * window — the goal-level counterpart to the existing per-domain priority
 * report. Only goals with at least one instance in the window are
 * returned, sorted by scheduled minutes descending (most time-invested
 * first).
 */
export async function computeGoalTimeInvestment(workspaceId: string, windowDays = 7): Promise<GoalTimeInvestment[]> {
  const windowEnd = todayISO();
  const windowStart = addDays(windowEnd, -(windowDays - 1));

  const [goals, instances] = await Promise.all([
    prisma.goal.findMany({ where: { workspaceId } }),
    prisma.taskInstance.findMany({
      where: { workspaceId, scheduledDate: { gte: windowStart, lte: windowEnd } },
      select: { goalId: true, durationMinutes: true, status: true },
    }),
  ]);

  const byGoal = new Map<string, { scheduledMinutes: number; completedMinutes: number }>();
  for (const inst of instances) {
    const bucket = byGoal.get(inst.goalId) ?? { scheduledMinutes: 0, completedMinutes: 0 };
    bucket.scheduledMinutes += inst.durationMinutes;
    if (inst.status === "completed") bucket.completedMinutes += inst.durationMinutes;
    byGoal.set(inst.goalId, bucket);
  }

  return goals
    .map((g) => {
      const bucket = byGoal.get(g.id);
      if (!bucket) return null;
      return {
        goalId: g.id,
        title: g.title,
        domain: g.domain as LifeDomain,
        status: g.status as GoalStatus,
        scheduledMinutes: bucket.scheduledMinutes,
        completedMinutes: bucket.completedMinutes,
        completionRate: bucket.scheduledMinutes > 0 ? bucket.completedMinutes / bucket.scheduledMinutes : 0,
      };
    })
    .filter((g): g is GoalTimeInvestment => g !== null)
    .sort((a, b) => b.scheduledMinutes - a.scheduledMinutes);
}
