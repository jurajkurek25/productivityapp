import type { FastifyInstance } from "fastify";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).max(120).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function authRoutes(app: FastifyInstance) {
  app.post("/auth/register", async (request, reply) => {
    const parsed = registerSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const { email, password, name } = parsed.data;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return reply.code(409).send({ error: "Email already registered" });

    const passwordHash = await bcrypt.hash(password, 10);
    const workspace = await prisma.workspace.create({
      data: { name: name ? `${name}'s workspace` : "My workspace" },
    });
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name,
        memberships: {
          create: { workspaceId: workspace.id, role: "OWNER" },
        },
      },
    });

    const token = app.jwt.sign({ userId: user.id, workspaceId: workspace.id });
    return reply.code(201).send({
      token,
      user: { id: user.id, email: user.email, name: user.name },
      workspace: { id: workspace.id, name: workspace.name },
    });
  });

  app.post("/auth/login", async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const { email, password } = parsed.data;

    const user = await prisma.user.findUnique({
      where: { email },
      include: { memberships: { include: { workspace: true } } },
    });
    if (!user) return reply.code(401).send({ error: "Invalid credentials" });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return reply.code(401).send({ error: "Invalid credentials" });

    const membership = user.memberships[0];
    if (!membership) return reply.code(500).send({ error: "No workspace for user" });

    const token = app.jwt.sign({ userId: user.id, workspaceId: membership.workspaceId });
    return reply.send({
      token,
      user: { id: user.id, email: user.email, name: user.name },
      workspace: { id: membership.workspace.id, name: membership.workspace.name },
    });
  });

  app.get("/me", { preHandler: [app.authenticate] }, async (request, reply) => {
    const { userId, workspaceId } = request.user;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } });
    if (!user || !workspace) return reply.code(404).send({ error: "Not found" });
    return reply.send({
      user: { id: user.id, email: user.email, name: user.name },
      workspace: { id: workspace.id, name: workspace.name },
    });
  });
}
