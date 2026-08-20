import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { pushEnabled } from "../lib/push.js";

const subscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});

const unsubscribeSchema = z.object({
  endpoint: z.string().url(),
});

export async function pushRoutes(app: FastifyInstance) {
  app.get("/push/public-key", async (_request, reply) => {
    if (!pushEnabled) return reply.code(404).send({ error: "Push notifications are not configured" });
    return { publicKey: process.env.VAPID_PUBLIC_KEY };
  });

  // Nested encapsulation context so the auth hook doesn't leak onto the
  // public-key route registered above it in this same plugin.
  await app.register(async (protectedRoutes) => {
    protectedRoutes.addHook("preHandler", app.authenticate);

    protectedRoutes.post("/push/subscribe", async (request, reply) => {
      const parsed = subscribeSchema.safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
      const { userId } = request.user;
      const { endpoint, keys } = parsed.data;

      await prisma.pushSubscription.upsert({
        where: { endpoint },
        create: { userId, endpoint, p256dh: keys.p256dh, auth: keys.auth },
        update: { userId, p256dh: keys.p256dh, auth: keys.auth },
      });
      return reply.code(204).send();
    });

    protectedRoutes.post("/push/unsubscribe", async (request, reply) => {
      const parsed = unsubscribeSchema.safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
      await prisma.pushSubscription.deleteMany({ where: { endpoint: parsed.data.endpoint } });
      return reply.code(204).send();
    });

    protectedRoutes.get("/push/status", async (request) => {
      const { userId } = request.user;
      const count = await prisma.pushSubscription.count({ where: { userId } });
      return { subscribed: count > 0 };
    });
  });
}
