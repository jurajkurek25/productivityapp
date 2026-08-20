import { prisma } from "./prisma.js";

const PACE_WINDOW_DAYS = 14;

export type GoalProgressStatus = "on_track" | "behind" | "no_deadline" | "no_planned_work";

export interface GoalProgress {
  goalId: string;
  targetDate: string | null;
  daysRemaining: number | null;
  /** Sum of estimatedMinutes across one-off ("once") steps — the finite, plannable backlog. Recurring steps (habits) have no fixed total, so they're excluded from this. */
  totalPlannedMinutes: number;
  /** Portion of totalPlannedMinutes whose step has at least one completed instance. */
  completedPlannedMinutes: number;
  remainingMinutes: number;
  /** All-time completed minutes across every step (including recurring habits) — total time actually invested in this goal. */
  totalCompletedMinutes: number;
  /** Average completed minutes/day for this goal over the last 14 days. */
  recentPaceMinutesPerDay: number;
  status: GoalProgressStatus;
  /** Self-set weekly time budget for this goal, independent of any deadline. */
  weeklyTargetMinutes: number | null;
  /** Completed minutes for this goal within the current Sun–Sat week. */
  currentWeekMinutes: number;
  /** Whether currentWeekMinutes has reached weeklyTargetMinutes — null when no target is set. */
  weeklyTargetMet: boolean | null;
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDays(date: string, n: number): string {
  return new Date(new Date(date + "T00:00:00Z").getTime() + n * 86_400_000).toISOString().slice(0, 10);
}

function diffDays(a: string, b: string): number {
  return Math.round((new Date(b + "T00:00:00Z").getTime() - new Date(a + "T00:00:00Z").getTime()) / 86_400_000);
}

function startOfWeek(date: string): string {
  const dow = new Date(date + "T00:00:00Z").getUTCDay();
  return addDays(date, -dow);
}

/**
 * Judges a goal's pace against its own targetDate using only what actually
 * happened (completed TaskInstances), not self-reported progress — same
 * "no self-rating" principle the energy engine follows. Recurring
 * (habit-style) steps have no finite backlog, so a goal made only of those
 * reports "no_planned_work" rather than a misleading 0%/100%.
 */
export async function computeGoalProgress(workspaceId: string, goalId: string): Promise<GoalProgress> {
  const [goal, steps] = await Promise.all([
    prisma.goal.findFirstOrThrow({ where: { id: goalId, workspaceId } }),
    prisma.step.findMany({ where: { goalId, workspaceId } }),
  ]);

  const onceSteps = steps.filter((s) => s.recurrenceFreq === "once");
  const onceStepIds = onceSteps.map((s) => s.id);

  const completedInstances = await prisma.taskInstance.findMany({
    where: { goalId, workspaceId, status: "completed" },
    select: { stepId: true, durationMinutes: true, completedAt: true, scheduledDate: true },
  });

  const totalPlannedMinutes = onceSteps.reduce((sum, s) => sum + s.estimatedMinutes, 0);
  const completedOnceStepIds = new Set(
    completedInstances.filter((i) => onceStepIds.includes(i.stepId)).map((i) => i.stepId)
  );
  const completedPlannedMinutes = onceSteps
    .filter((s) => completedOnceStepIds.has(s.id))
    .reduce((sum, s) => sum + s.estimatedMinutes, 0);
  const remainingMinutes = Math.max(0, totalPlannedMinutes - completedPlannedMinutes);

  const totalCompletedMinutes = completedInstances.reduce((sum, i) => sum + i.durationMinutes, 0);

  const paceWindowStart = addDays(todayISO(), -PACE_WINDOW_DAYS);
  const recentMinutes = completedInstances
    .filter((i) => i.scheduledDate >= paceWindowStart)
    .reduce((sum, i) => sum + i.durationMinutes, 0);
  const recentPaceMinutesPerDay = Math.round((recentMinutes / PACE_WINDOW_DAYS) * 10) / 10;

  const daysRemaining = goal.targetDate ? diffDays(todayISO(), goal.targetDate) : null;

  const currentWeekStart = startOfWeek(todayISO());
  const currentWeekMinutes = completedInstances
    .filter((i) => i.scheduledDate >= currentWeekStart)
    .reduce((sum, i) => sum + i.durationMinutes, 0);
  const weeklyTargetMet = goal.weeklyTargetMinutes == null ? null : currentWeekMinutes >= goal.weeklyTargetMinutes;

  let status: GoalProgressStatus;
  if (!goal.targetDate) {
    status = "no_deadline";
  } else if (totalPlannedMinutes === 0) {
    status = "no_planned_work";
  } else if (remainingMinutes === 0) {
    status = "on_track";
  } else if (daysRemaining !== null && daysRemaining < 0) {
    status = "behind";
  } else {
    const projected = recentPaceMinutesPerDay * Math.max(0, daysRemaining ?? 0);
    status = projected >= remainingMinutes ? "on_track" : "behind";
  }

  return {
    goalId,
    targetDate: goal.targetDate,
    daysRemaining,
    totalPlannedMinutes,
    completedPlannedMinutes,
    remainingMinutes,
    totalCompletedMinutes,
    recentPaceMinutesPerDay,
    status,
    weeklyTargetMinutes: goal.weeklyTargetMinutes,
    currentWeekMinutes,
    weeklyTargetMet,
  };
}

export interface BehindPaceGoal {
  goalId: string;
  title: string;
  targetDate: string;
  daysRemaining: number;
  remainingMinutes: number;
}

/** Active goals with a deadline that are currently behind pace — the Dashboard summary banner's data source. */
export async function listGoalsBehindPace(workspaceId: string): Promise<BehindPaceGoal[]> {
  const goals = await prisma.goal.findMany({ where: { workspaceId, status: "active", targetDate: { not: null } } });

  const results: BehindPaceGoal[] = [];
  for (const goal of goals) {
    const progress = await computeGoalProgress(workspaceId, goal.id);
    if (progress.status === "behind") {
      results.push({
        goalId: goal.id,
        title: goal.title,
        targetDate: goal.targetDate!,
        daysRemaining: progress.daysRemaining!,
        remainingMinutes: progress.remainingMinutes,
      });
    }
  }
  return results;
}
