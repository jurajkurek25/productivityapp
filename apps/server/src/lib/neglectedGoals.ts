import type { LifeDomain } from "@productivityapp/core";
import { prisma } from "./prisma.js";

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDays(date: string, n: number): string {
  return new Date(new Date(date + "T00:00:00Z").getTime() + n * 86_400_000).toISOString().slice(0, 10);
}

export interface NeglectedGoal {
  goalId: string;
  title: string;
  domain: LifeDomain;
  /** Days since the last completed instance, or null if the goal has never had one. */
  daysSinceLastActivity: number | null;
}

/**
 * Active goals with no completed activity in the last `windowDays` days —
 * catches goals that quietly stall even when they have no targetDate to
 * measure "behind pace" against. A goal younger than the window is
 * excluded rather than flagged on day one; a goal that has NEVER had any
 * completed instance is included once it's old enough to judge.
 */
export async function listNeglectedGoals(workspaceId: string, windowDays = 14): Promise<NeglectedGoal[]> {
  const today = todayISO();
  const windowStart = addDays(today, -windowDays);
  const windowStartDate = new Date(windowStart + "T00:00:00Z");

  const goals = await prisma.goal.findMany({ where: { workspaceId, status: "active" } });
  const eligibleGoals = goals.filter((g) => g.createdAt <= windowStartDate);

  const results: NeglectedGoal[] = [];
  for (const goal of eligibleGoals) {
    const lastCompleted = await prisma.taskInstance.findFirst({
      where: { goalId: goal.id, workspaceId, status: "completed" },
      orderBy: { scheduledDate: "desc" },
      select: { scheduledDate: true },
    });

    if (!lastCompleted || lastCompleted.scheduledDate < windowStart) {
      results.push({
        goalId: goal.id,
        title: goal.title,
        domain: goal.domain as LifeDomain,
        daysSinceLastActivity: lastCompleted
          ? Math.round(
              (new Date(today + "T00:00:00Z").getTime() - new Date(lastCompleted.scheduledDate + "T00:00:00Z").getTime()) /
                86_400_000
            )
          : null,
      });
    }
  }
  return results;
}
