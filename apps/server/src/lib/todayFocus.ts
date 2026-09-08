import { prisma } from "./prisma.js";
import type { LifeDomain } from "@productivityapp/core";

const URGENT_DEADLINE_WINDOW_DAYS = 7;
const IMPORTANT_PRIORITY_THRESHOLD = 4;

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function diffDays(a: string, b: string): number {
  return Math.round((new Date(b + "T00:00:00Z").getTime() - new Date(a + "T00:00:00Z").getTime()) / 86_400_000);
}

export type FocusQuadrant = "do_now" | "protect_time" | "quick_win" | "reconsider";

export interface TodayFocusItem {
  instanceId: string;
  title: string;
  domain: LifeDomain;
  durationMinutes: number;
  goalId: string;
  goalTitle: string;
  quadrant: FocusQuadrant;
}

/**
 * Eisenhower-style urgent/important split of today's still-open plan.
 * Urgency comes from an approaching-or-passed goal deadline (or the task
 * being a recovered missed one); importance comes from the step's own
 * priority (1-5) — both already recorded, no separate self-rating needed.
 */
export async function computeTodayFocus(workspaceId: string): Promise<TodayFocusItem[]> {
  const today = todayISO();
  const instances = await prisma.taskInstance.findMany({
    where: { workspaceId, scheduledDate: today, status: "scheduled" },
    include: { step: { select: { priority: true } } },
  });
  if (instances.length === 0) return [];

  const goalIds = [...new Set(instances.map((i) => i.goalId))];
  const goals = await prisma.goal.findMany({ where: { workspaceId, id: { in: goalIds } } });
  const goalById = new Map(goals.map((g) => [g.id, g]));

  return instances.map((inst) => {
    const goal = goalById.get(inst.goalId);
    const important = inst.step.priority >= IMPORTANT_PRIORITY_THRESHOLD;
    const daysRemaining = goal?.targetDate ? diffDays(today, goal.targetDate) : null;
    const urgent = inst.rescheduledFrom != null || (daysRemaining !== null && daysRemaining <= URGENT_DEADLINE_WINDOW_DAYS);

    let quadrant: FocusQuadrant;
    if (urgent && important) quadrant = "do_now";
    else if (!urgent && important) quadrant = "protect_time";
    else if (urgent && !important) quadrant = "quick_win";
    else quadrant = "reconsider";

    return {
      instanceId: inst.id,
      title: inst.title,
      domain: inst.domain as LifeDomain,
      durationMinutes: inst.durationMinutes,
      goalId: inst.goalId,
      goalTitle: goal?.title ?? "",
      quadrant,
    };
  });
}
