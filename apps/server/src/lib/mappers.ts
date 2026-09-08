import type { Step as PrismaStep, TaskInstance as PrismaTaskInstance } from "@prisma/client";
import type {
  LifeDomain,
  RecurrenceFrequency,
  RecurrenceRule,
  Step,
  StepStatus,
  TaskInstance,
  TaskInstanceStatus,
} from "@productivityapp/core";

// Prisma stores these as plain strings (SQLite has no enum support); zod
// validates them on the way in, so casting back out here is safe.

export function toDomainStep(row: PrismaStep): Step {
  const recurrence: RecurrenceRule = {
    freq: row.recurrenceFreq as RecurrenceFrequency,
    daysOfWeek: row.recurrenceDaysOfWeek
      ? row.recurrenceDaysOfWeek.split(",").map((s) => Number(s.trim()))
      : undefined,
    interval: row.recurrenceInterval,
    until: row.recurrenceUntil ?? undefined,
  };
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    goalId: row.goalId,
    domain: row.domain as LifeDomain,
    title: row.title,
    notes: row.notes ?? undefined,
    estimatedMinutes: row.estimatedMinutes,
    priority: row.priority,
    recurrence,
    status: row.status as StepStatus,
    earliestDate: row.earliestDate ?? undefined,
    aiSuggested: row.aiSuggested,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toDomainTaskInstance(row: PrismaTaskInstance): TaskInstance {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    stepId: row.stepId,
    goalId: row.goalId,
    domain: row.domain as LifeDomain,
    title: row.title,
    scheduledDate: row.scheduledDate,
    startMinute: row.startMinute ?? undefined,
    durationMinutes: row.durationMinutes,
    status: row.status as TaskInstanceStatus,
    completedAt: row.completedAt?.toISOString(),
    rescheduledFrom: row.rescheduledFrom ?? undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function recurrenceToRow(recurrence: RecurrenceRule) {
  return {
    recurrenceFreq: recurrence.freq,
    recurrenceDaysOfWeek: recurrence.daysOfWeek?.join(",") ?? "",
    recurrenceInterval: recurrence.interval ?? 1,
    recurrenceUntil: recurrence.until ?? null,
  };
}
