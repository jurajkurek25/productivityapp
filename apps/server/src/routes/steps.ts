import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { LIFE_DOMAINS } from "@productivityapp/core";
import { prisma } from "../lib/prisma.js";
import { recurrenceToRow, toDomainStep } from "../lib/mappers.js";

const recurrenceSchema = z.object({
  freq: z.enum(["once", "daily", "weekly", "monthly"]),
  daysOfWeek: z.array(z.number().min(0).max(6)).optional(),
  interval: z.number().min(1).optional(),
  until: z.string().optional(),
});

const createStepSchema = z.object({
  goalId: z.string(),
  domain: z.enum(LIFE_DOMAINS),
  title: z.string().min(1).max(200),
  notes: z.string().max(2000).optional(),
  estimatedMinutes: z.number().min(1).max(24 * 60),
  priority: z.number().min(1).max(5).default(3),
  recurrence: recurrenceSchema,
  earliestDate: z.string().optional(),
  aiSuggested: z.boolean().default(false),
});

const updateStepSchema = createStepSchema.partial().extend({
  status: z.enum(["pending", "active", "done", "archived"]).optional(),
});

export async function stepRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.authenticate);

  app.get("/steps", async (request) => {
    const { workspaceId } = request.user;
    const { goalId } = request.query as { goalId?: string };
    const rows = await prisma.step.findMany({
      where: { workspaceId, ...(goalId ? { goalId } : {}) },
      orderBy: { createdAt: "desc" },
    });
    return rows.map(toDomainStep);
  });

  app.post("/steps", async (request, reply) => {
    const parsed = createStepSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const { workspaceId } = request.user;
    const { recurrence, ...rest } = parsed.data;

    const goal = await prisma.goal.findFirst({ where: { id: rest.goalId, workspaceId } });
    if (!goal) return reply.code(400).send({ error: "goalId does not belong to this workspace" });

    const step = await prisma.step.create({
      data: { ...rest, workspaceId, ...recurrenceToRow(recurrence) },
    });
    return reply.code(201).send(toDomainStep(step));
  });

  app.patch("/steps/:id", async (request, reply) => {
    const parsed = updateStepSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const { workspaceId } = request.user;
    const { id } = request.params as { id: string };
    const existing = await prisma.step.findFirst({ where: { id, workspaceId } });
    if (!existing) return reply.code(404).send({ error: "Not found" });

    const { recurrence, ...rest } = parsed.data;
    const step = await prisma.step.update({
      where: { id },
      data: { ...rest, ...(recurrence ? recurrenceToRow(recurrence) : {}) },
    });
    return toDomainStep(step);
  });

  app.delete("/steps/:id", async (request, reply) => {
    const { workspaceId } = request.user;
    const { id } = request.params as { id: string };
    const existing = await prisma.step.findFirst({ where: { id, workspaceId } });
    if (!existing) return reply.code(404).send({ error: "Not found" });
    await prisma.step.delete({ where: { id } });
    return reply.code(204).send();
  });
}
