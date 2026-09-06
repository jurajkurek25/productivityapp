import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { LIFE_DOMAINS } from "@productivityapp/core";
import { prisma } from "../lib/prisma.js";
import { parseWeeklyCapacity } from "../lib/capacity.js";
import { toDomainStep, toDomainTaskInstance } from "../lib/mappers.js";
import { computeEstimateAccuracy } from "../lib/estimateAccuracy.js";

const estimateAccuracyQuerySchema = z.object({ windowDays: z.coerce.number().min(1).max(365).optional() });

const dayCapacitySchema = z.object(
  Object.fromEntries(LIFE_DOMAINS.map((d) => [d, z.number().min(0).max(24 * 60)])) as Record<
    (typeof LIFE_DOMAINS)[number],
    z.ZodNumber
  >
);

const capacitySchema = z.object({
  days: z.array(dayCapacitySchema).length(7),
});

export async function workspaceRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.authenticate);

  app.get("/workspace/capacity", async (request) => {
    const { workspaceId } = request.user;
    const workspace = await prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId } });
    return parseWeeklyCapacity(workspace.weeklyCapacityJson);
  });

  app.put("/workspace/capacity", async (request, reply) => {
    const parsed = capacitySchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const { workspaceId } = request.user;

    await prisma.workspace.update({
      where: { id: workspaceId },
      data: { weeklyCapacityJson: JSON.stringify(parsed.data) },
    });
    return parsed.data;
  });

  /** Full data export as a downloadable JSON file — the only backup path for a single-SQLite-file deployment. */
  app.get("/workspace/export", async (request, reply) => {
    const { workspaceId } = request.user;
    const [workspace, goals, steps, instances] = await Promise.all([
      prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId } }),
      prisma.goal.findMany({ where: { workspaceId } }),
      prisma.step.findMany({ where: { workspaceId } }),
      prisma.taskInstance.findMany({ where: { workspaceId } }),
    ]);

    const filename = `balance-export-${new Date().toISOString().slice(0, 10)}.json`;
    reply.header("Content-Disposition", `attachment; filename="${filename}"`);
    return reply.send({
      exportedAt: new Date().toISOString(),
      workspace: { id: workspace.id, name: workspace.name },
      weeklyCapacity: parseWeeklyCapacity(workspace.weeklyCapacityJson),
      goals,
      steps: steps.map(toDomainStep),
      taskInstances: instances.map(toDomainTaskInstance),
    });
  });

  /** Actual vs. estimated minutes by domain — a data-driven calibration signal, not a self-assessment. */
  app.get("/workspace/estimate-accuracy", async (request, reply) => {
    const parsed = estimateAccuracyQuerySchema.safeParse(request.query);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const { workspaceId } = request.user;
    return computeEstimateAccuracy(workspaceId, parsed.data.windowDays ?? 90);
  });
}
