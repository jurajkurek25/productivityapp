import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { defaultEnergyEngine } from "@productivityapp/core";
import { buildCompletionHistory, buildEnergyTrend } from "../lib/energyHistory.js";

const querySchema = z.object({ date: z.string().optional() });
const trendQuerySchema = z.object({ days: z.coerce.number().min(2).max(90).optional() });

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function energyRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.authenticate);

  app.get("/energy", async (request, reply) => {
    const parsed = querySchema.safeParse(request.query);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const { workspaceId } = request.user;
    const date = parsed.data.date ?? todayISO();

    const history = await buildCompletionHistory(workspaceId, date);
    const state = defaultEnergyEngine.infer(history, date);
    return reply.send(state);
  });

  app.get("/energy/trend", async (request, reply) => {
    const parsed = trendQuerySchema.safeParse(request.query);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const { workspaceId } = request.user;
    const points = await buildEnergyTrend(workspaceId, parsed.data.days ?? 30);
    return reply.send(points);
  });
}
