import type { EnergyState, TaskInstance, UnplacedCandidate } from "@productivityapp/core";
import { defaultEnergyEngine, scheduleRange } from "@productivityapp/core";
import { prisma } from "./prisma.js";
import { toDomainStep, toDomainTaskInstance } from "./mappers.js";
import { buildCompletionHistory } from "./energyHistory.js";
import { parseWeeklyCapacity } from "./capacity.js";

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDays(date: string, n: number): string {
  const t = new Date(date + "T00:00:00Z").getTime() + n * 86_400_000;
  return new Date(t).toISOString().slice(0, 10);
}

/**
 * Runs the scheduler for a workspace over a date range: expands active
 * steps' recurrence, infers today's energy state from recent completion
 * history, and places new TaskInstances into whatever capacity remains
 * after energy scaling. Safe to call repeatedly — it never re-schedules a
 * step onto a date that already has an instance for it. Shared by the
 * authenticated POST /calendar/generate route and the nightly auto-schedule
 * cron job, which has no request/user context of its own.
 */
export async function generateSchedule(
  workspaceId: string,
  rangeStart: string,
  rangeEnd: string
): Promise<{ energyState: EnergyState; placed: TaskInstance[]; unplaced: UnplacedCandidate[] }> {
  const [workspace, stepRows, existingRows] = await Promise.all([
    prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId } }),
    prisma.step.findMany({ where: { workspaceId, status: { in: ["pending", "active"] } } }),
    prisma.taskInstance.findMany({ where: { workspaceId } }),
  ]);

  const today = todayISO();
  const history = await buildCompletionHistory(workspaceId, today);
  const energyState = defaultEnergyEngine.infer(history, today);

  const result = scheduleRange({
    steps: stepRows.map(toDomainStep),
    existingInstances: existingRows.map(toDomainTaskInstance),
    weeklyCapacity: parseWeeklyCapacity(workspace.weeklyCapacityJson),
    energyByDate: (date) => ({ ...energyState, date }),
    rangeStart,
    rangeEnd,
    makeId: () => crypto.randomUUID(),
    now: () => new Date().toISOString(),
  });

  if (result.placed.length > 0) {
    await prisma.taskInstance.createMany({
      data: result.placed.map((p) => ({
        id: p.id,
        workspaceId: p.workspaceId,
        stepId: p.stepId,
        goalId: p.goalId,
        domain: p.domain,
        title: p.title,
        scheduledDate: p.scheduledDate,
        durationMinutes: p.durationMinutes,
        status: "scheduled",
        rescheduledFrom: p.rescheduledFrom ?? null,
      })),
    });
  }

  return { energyState, placed: result.placed, unplaced: result.unplaced };
}

/**
 * Runs generateSchedule for every workspace's upcoming week, so the calendar
 * is already populated by the time a user opens the app (and the morning
 * push reminder reflects a real plan instead of an empty day). One
 * workspace failing doesn't stop the rest from being scheduled.
 */
export async function autoScheduleAllWorkspaces(daysAhead = 6): Promise<void> {
  const workspaces = await prisma.workspace.findMany({ select: { id: true } });
  const today = todayISO();
  const rangeEnd = addDays(today, daysAhead);

  for (const { id } of workspaces) {
    await generateSchedule(id, today, rangeEnd).catch((err) => {
      console.error(`Auto-schedule failed for workspace ${id}:`, err);
    });
  }
}
