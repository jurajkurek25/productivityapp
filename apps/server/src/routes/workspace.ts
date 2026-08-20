import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { LIFE_DOMAINS } from "@productivityapp/core";
import { prisma } from "../lib/prisma.js";
import { parseWeeklyCapacity } from "../lib/capacity.js";

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
}
