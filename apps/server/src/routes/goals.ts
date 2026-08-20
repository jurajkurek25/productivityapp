import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { LIFE_DOMAINS, suggestStepsForGoal } from "@productivityapp/core";
import { prisma } from "../lib/prisma.js";
import { toDomainStep } from "../lib/mappers.js";

const createGoalSchema = z.object({
  domain: z.enum(LIFE_DOMAINS),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  targetDate: z.string().optional(),
});

const updateGoalSchema = createGoalSchema.partial().extend({
  status: z.enum(["active", "paused", "completed", "abandoned"]).optional(),
});

export async function goalRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.authenticate);

  app.get("/goals", async (request) => {
    const { workspaceId } = request.user;
    return prisma.goal.findMany({ where: { workspaceId }, orderBy: { createdAt: "desc" } });
  });

  app.post("/goals", async (request, reply) => {
    const parsed = createGoalSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const { workspaceId } = request.user;
    const goal = await prisma.goal.create({ data: { ...parsed.data, workspaceId } });
    return reply.code(201).send(goal);
  });

  app.get("/goals/:id", async (request, reply) => {
    const { workspaceId } = request.user;
    const { id } = request.params as { id: string };
    const goal = await prisma.goal.findFirst({ where: { id, workspaceId }, include: { steps: true } });
    if (!goal) return reply.code(404).send({ error: "Not found" });
    return { ...goal, steps: goal.steps.map(toDomainStep) };
  });

  app.patch("/goals/:id", async (request, reply) => {
    const parsed = updateGoalSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const { workspaceId } = request.user;
    const { id } = request.params as { id: string };
    const existing = await prisma.goal.findFirst({ where: { id, workspaceId } });
    if (!existing) return reply.code(404).send({ error: "Not found" });
    const goal = await prisma.goal.update({ where: { id }, data: parsed.data });
    return goal;
  });

  app.delete("/goals/:id", async (request, reply) => {
    const { workspaceId } = request.user;
    const { id } = request.params as { id: string };
    const existing = await prisma.goal.findFirst({ where: { id, workspaceId } });
    if (!existing) return reply.code(404).send({ error: "Not found" });
    await prisma.goal.delete({ where: { id } });
    return reply.code(204).send();
  });

  /** Rule-based (swappable) breakdown suggestions — not persisted until accepted via POST /steps. */
  app.get("/goals/:id/suggest-steps", async (request, reply) => {
    const { workspaceId } = request.user;
    const { id } = request.params as { id: string };
    const goal = await prisma.goal.findFirst({ where: { id, workspaceId } });
    if (!goal) return reply.code(404).send({ error: "Not found" });
    return suggestStepsForGoal({ title: goal.title, domain: goal.domain as (typeof LIFE_DOMAINS)[number] });
  });
}
