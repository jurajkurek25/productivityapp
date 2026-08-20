import { prisma } from "./prisma.js";

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDays(date: string, n: number): string {
  return new Date(new Date(date + "T00:00:00Z").getTime() + n * 86_400_000).toISOString().slice(0, 10);
}

function startOfWeek(date: string): string {
  const dow = new Date(date + "T00:00:00Z").getUTCDay();
  return addDays(date, -dow);
}

export interface GoalInvestmentTrendPoint {
  weekStart: string;
  completedMinutes: number;
}

/** Completed minutes per week for one goal, oldest week first — is the time going into this goal trending up or down? */
export async function computeGoalInvestmentTrend(
  workspaceId: string,
  goalId: string,
  weeks = 8
): Promise<GoalInvestmentTrendPoint[]> {
  const currentWeekStart = startOfWeek(todayISO());
  const rangeStart = addDays(currentWeekStart, -(weeks - 1) * 7);

  const instances = await prisma.taskInstance.findMany({
    where: { workspaceId, goalId, status: "completed", scheduledDate: { gte: rangeStart } },
    select: { scheduledDate: true, durationMinutes: true },
  });

  const points: GoalInvestmentTrendPoint[] = [];
  for (let i = 0; i < weeks; i++) {
    const weekStart = addDays(currentWeekStart, -(weeks - 1 - i) * 7);
    const weekEnd = addDays(weekStart, 6);
    const completedMinutes = instances
      .filter((inst) => inst.scheduledDate >= weekStart && inst.scheduledDate <= weekEnd)
      .reduce((sum, inst) => sum + inst.durationMinutes, 0);
    points.push({ weekStart, completedMinutes });
  }
  return points;
}
