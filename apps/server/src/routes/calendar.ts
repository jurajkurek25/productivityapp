import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { LIFE_DOMAINS, defaultEnergyEngine, scheduleRange } from "@productivityapp/core";
import { prisma } from "../lib/prisma.js";
import { toDomainStep, toDomainTaskInstance } from "../lib/mappers.js";
import { buildCompletionHistory } from "../lib/energyHistory.js";
import { parseWeeklyCapacity } from "../lib/capacity.js";

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

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
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

  /**
   * Runs the scheduler for a date range: expands active steps' recurrence,
   * infers today's energy state from recent completion history, and places
   * new TaskInstances into whatever capacity remains after energy scaling.
   * Safe to call repeatedly — it never re-schedules a step onto a date that
   * already has an instance for it.
   */
  app.post("/calendar/generate", async (request, reply) => {
    const parsed = generateSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const { workspaceId } = request.user;
    const { rangeStart, rangeEnd } = parsed.data;

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

    return reply.send({ energyState, placed: result.placed, unplaced: result.unplaced });
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
