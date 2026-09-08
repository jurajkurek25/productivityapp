import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { LIFE_DOMAINS } from "@productivityapp/core";
import { prisma } from "../lib/prisma.js";
import { toDomainTaskInstance } from "../lib/mappers.js";
import { generateSchedule } from "../lib/scheduling.js";
import { computeTodayFocus } from "../lib/todayFocus.js";

const rangeQuerySchema = z.object({
  start: z.string(),
  end: z.string(),
});

const generateSchema = z.object({
  rangeStart: z.string(),
  rangeEnd: z.string(),
});

const updateInstanceSchema = z
  .object({
    status: z.enum(["scheduled", "completed", "missed", "skipped"]).optional(),
    title: z.string().min(1).max(200).optional(),
    domain: z.enum(LIFE_DOMAINS).optional(),
    scheduledDate: z.string().optional(),
    durationMinutes: z.number().min(1).max(24 * 60).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: "At least one field is required" });

const quickTaskSchema = z.object({
  title: z.string().min(1).max(200),
  domain: z.enum(LIFE_DOMAINS),
  scheduledDate: z.string().optional(),
  durationMinutes: z.number().min(1).max(24 * 60).default(30),
});

const rescheduleMissedSchema = z.object({
  targetDate: z.string().optional(),
});

const INBOX_GOAL_TITLE = "Rýchle úlohy";

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Quick-add tasks land under one auto-provisioned "inbox" goal so they reuse
 * the existing Step/TaskInstance pipeline (energy history, balance report)
 * without requiring the user to create a goal first. Step.domain is
 * independent of the goal's own domain, so tasks of any domain can share it.
 */
async function getOrCreateInboxGoal(workspaceId: string) {
  const existing = await prisma.goal.findFirst({ where: { workspaceId, title: INBOX_GOAL_TITLE } });
  if (existing) return existing;
  return prisma.goal.create({
    data: { workspaceId, domain: "business", title: INBOX_GOAL_TITLE, status: "active" },
  });
}

export async function calendarRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.authenticate);

  app.get("/calendar", async (request, reply) => {
    const parsed = rangeQuerySchema.safeParse(request.query);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const { workspaceId } = request.user;
    const { start, end } = parsed.data;
    const rows = await prisma.taskInstance.findMany({
      where: { workspaceId, scheduledDate: { gte: start, lte: end } },
      orderBy: [{ scheduledDate: "asc" }],
    });
    return rows.map(toDomainTaskInstance);
  });

  app.post("/calendar/generate", async (request, reply) => {
    const parsed = generateSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const { workspaceId } = request.user;
    const { rangeStart, rangeEnd } = parsed.data;

    const result = await generateSchedule(workspaceId, rangeStart, rangeEnd);
    return reply.send(result);
  });

  /**
   * Creates a one-off task without requiring the user to first create a
   * goal/step — an "inbox" goal absorbs it so it still participates in
   * energy history and the domain-balance report like everything else.
   */
  app.post("/calendar/quick", async (request, reply) => {
    const parsed = quickTaskSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const { workspaceId } = request.user;
    const { title, domain, durationMinutes } = parsed.data;
    const scheduledDate = parsed.data.scheduledDate ?? todayISO();

    const goal = await getOrCreateInboxGoal(workspaceId);
    const step = await prisma.step.create({
      data: {
        workspaceId,
        goalId: goal.id,
        domain,
        title,
        estimatedMinutes: durationMinutes,
        priority: 3,
        recurrenceFreq: "once",
        status: "archived",
        earliestDate: scheduledDate,
      },
    });
    const instance = await prisma.taskInstance.create({
      data: {
        workspaceId,
        stepId: step.id,
        goalId: goal.id,
        domain,
        title,
        scheduledDate,
        durationMinutes,
        status: "scheduled",
      },
    });
    return reply.code(201).send(toDomainTaskInstance(instance));
  });

  // Only "scheduled" rows are still-actionable overdue tasks. A row already
  // finalized to "missed" (by this same reschedule flow) has already had a
  // fresh instance created for it, so it must not keep counting forever.
  app.get("/calendar/missed-count", async (request) => {
    const { workspaceId } = request.user;
    const count = await prisma.taskInstance.count({
      where: { workspaceId, status: "scheduled", scheduledDate: { lt: todayISO() } },
    });
    return { count };
  });

  /** Eisenhower-style urgent/important split of today's still-open plan — "what should I actually do first". */
  app.get("/calendar/today-focus", async (request) => {
    const { workspaceId } = request.user;
    return computeTodayFocus(workspaceId);
  });

  /**
   * Finalizes every overdue "scheduled" instance as "missed" — preserving
   * accurate completion history for its original date — then creates one
   * fresh "scheduled" instance per affected step on targetDate, linked back
   * via rescheduledFrom. A step already occurring on targetDate is left
   * alone rather than double-booked.
   */
  app.post("/calendar/reschedule-missed", async (request, reply) => {
    const parsed = rescheduleMissedSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const { workspaceId } = request.user;
    const today = todayISO();
    const targetDate = parsed.data.targetDate ?? today;

    const overdueRows = await prisma.taskInstance.findMany({
      where: { workspaceId, status: "scheduled", scheduledDate: { lt: today } },
    });

    const existingOnTarget = await prisma.taskInstance.findMany({
      where: { workspaceId, scheduledDate: targetDate },
      select: { stepId: true },
    });
    const stepsOnTarget = new Set(existingOnTarget.map((r) => r.stepId));

    let rescheduledCount = 0;
    for (const row of overdueRows) {
      await prisma.taskInstance.update({ where: { id: row.id }, data: { status: "missed" } });
      if (stepsOnTarget.has(row.stepId)) continue;
      await prisma.taskInstance.create({
        data: {
          workspaceId,
          stepId: row.stepId,
          goalId: row.goalId,
          domain: row.domain,
          title: row.title,
          scheduledDate: targetDate,
          durationMinutes: row.durationMinutes,
          status: "scheduled",
          rescheduledFrom: row.scheduledDate,
        },
      });
      stepsOnTarget.add(row.stepId);
      rescheduledCount++;
    }

    return reply.send({ rescheduledCount, targetDate });
  });

  app.patch("/calendar/instances/:id", async (request, reply) => {
    const parsed = updateInstanceSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const { workspaceId } = request.user;
    const { id } = request.params as { id: string };
    const existing = await prisma.taskInstance.findFirst({ where: { id, workspaceId } });
    if (!existing) return reply.code(404).send({ error: "Not found" });

    const { status, ...rest } = parsed.data;
    const instance = await prisma.taskInstance.update({
      where: { id },
      data: {
        ...rest,
        ...(status !== undefined
          ? { status, completedAt: status === "completed" ? new Date() : null }
          : {}),
      },
    });
    return toDomainTaskInstance(instance);
  });
}
