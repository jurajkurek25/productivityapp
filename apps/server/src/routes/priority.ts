import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { computeDomainBalance } from "@productivityapp/core";
import { prisma } from "../lib/prisma.js";
import { toDomainTaskInstance } from "../lib/mappers.js";

const querySchema = z.object({ windowDays: z.coerce.number().min(1).max(90).optional() });

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDays(date: string, n: number): string {
  const t = new Date(date + "T00:00:00Z").getTime() + n * 86_400_000;
  return new Date(t).toISOString().slice(0, 10);
}

export async function priorityRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.authenticate);

  app.get("/priority", async (request, reply) => {
    const parsed = querySchema.safeParse(request.query);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const { workspaceId } = request.user;
    const windowDays = parsed.data.windowDays ?? 7;
    const windowEnd = todayISO();
    const windowStart = addDays(windowEnd, -(windowDays - 1));

    const rows = await prisma.taskInstance.findMany({
      where: { workspaceId, scheduledDate: { gte: windowStart, lte: windowEnd } },
    });

    const report = computeDomainBalance({
      instances: rows.map(toDomainTaskInstance),
      windowStart,
      windowEnd,
    });
    return reply.send(report);
  });
}
