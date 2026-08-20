import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { LIFE_DOMAINS, suggestStepsForGoal } from "@productivityapp/core";
import { prisma } from "../lib/prisma.js";
import { toDomainStep } from "../lib/mappers.js";
import { computeGoalProgress, listGoalsBehindPace } from "../lib/goalProgress.js";
import { computeGoalTimeInvestment } from "../lib/goalTimeInvestment.js";
import { listNeglectedGoals } from "../lib/neglectedGoals.js";
import { computeGoalInvestmentTrend } from "../lib/goalInvestmentTrend.js";

const timeInvestmentQuerySchema = z.object({ windowDays: z.coerce.number().min(1).max(90).optional() });
const neglectedQuerySchema = z.object({ windowDays: z.coerce.number().min(1).max(90).optional() });
const investmentTrendQuerySchema = z.object({ weeks: z.coerce.number().min(1).max(52).optional() });

const createGoalSchema = z.object({
  domain: z.enum(LIFE_DOMAINS),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  targetDate: z.string().optional(),
  weeklyTargetMinutes: z.number().min(0).max(10080).optional(),
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

  /** Active goals with a deadline that are currently behind pace — Dashboard summary banner. */
  app.get("/goals/progress-summary", async (request) => {
    const { workspaceId } = request.user;
    return listGoalsBehindPace(workspaceId);
  });

  /** Per-goal scheduled/completed minutes over a trailing window — Dashboard time-investment card. */
  app.get("/goals/time-investment", async (request, reply) => {
    const parsed = timeInvestmentQuerySchema.safeParse(request.query);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const { workspaceId } = request.user;
    return computeGoalTimeInvestment(workspaceId, parsed.data.windowDays ?? 7);
  });

  /** Active goals with no completed activity in the window — catches goals with no targetDate that just stall. */
  app.get("/goals/neglected", async (request, reply) => {
    const parsed = neglectedQuerySchema.safeParse(request.query);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const { workspaceId } = request.user;
    return listNeglectedGoals(workspaceId, parsed.data.windowDays ?? 14);
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

  app.get("/goals/:id/progress", async (request, reply) => {
    const { workspaceId } = request.user;
    const { id } = request.params as { id: string };
    const goal = await prisma.goal.findFirst({ where: { id, workspaceId } });
    if (!goal) return reply.code(404).send({ error: "Not found" });
    return computeGoalProgress(workspaceId, id);
  });

  app.get("/goals/:id/investment-trend", async (request, reply) => {
    const parsed = investmentTrendQuerySchema.safeParse(request.query);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const { workspaceId } = request.user;
    const { id } = request.params as { id: string };
    const goal = await prisma.goal.findFirst({ where: { id, workspaceId } });
    if (!goal) return reply.code(404).send({ error: "Not found" });
    return computeGoalInvestmentTrend(workspaceId, id, parsed.data.weeks ?? 8);
  });
}
