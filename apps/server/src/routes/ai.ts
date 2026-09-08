import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type Anthropic from "@anthropic-ai/sdk";
import { prisma } from "../lib/prisma.js";
import { isAiAssistantConfigured, runAssistantTurn, type AiAction } from "../lib/aiAssistant.js";

const chatSchema = z.object({ message: z.string().min(1).max(2000) });

function toHistoryParam(role: string, content: string): Anthropic.MessageParam {
  return { role: role === "assistant" ? "assistant" : "user", content };
}

export async function aiRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.authenticate);

  app.get("/ai/status", async () => {
    return { configured: isAiAssistantConfigured() };
  });

  app.get("/ai/messages", async (request) => {
    const { workspaceId } = request.user;
    const rows = await prisma.aiMessage.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "asc" },
    });
    return rows.map((r) => ({
      id: r.id,
      role: r.role,
      content: r.content,
      actions: r.actionsJson ? (JSON.parse(r.actionsJson) as AiAction[]) : [],
      createdAt: r.createdAt.toISOString(),
    }));
  });

  app.post("/ai/chat", async (request, reply) => {
    const parsed = chatSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    if (!isAiAssistantConfigured()) {
      return reply.code(503).send({ error: "AI asistent nie je nastavený — na serveri chýba ANTHROPIC_API_KEY." });
    }

    const { workspaceId } = request.user;
    const { message } = parsed.data;

    const priorRows = await prisma.aiMessage.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "asc" },
    });
    const history = priorRows.map((r) => toHistoryParam(r.role, r.content));

    await prisma.aiMessage.create({ data: { workspaceId, role: "user", content: message } });

    let replyText: string;
    let actions: AiAction[];
    try {
      ({ reply: replyText, actions } = await runAssistantTurn(workspaceId, history, message));
    } catch (err) {
      request.log.error(err, "AI assistant turn failed");
      return reply.code(502).send({ error: "Asistent má práve problém, skús to o chvíľu znova." });
    }

    const saved = await prisma.aiMessage.create({
      data: {
        workspaceId,
        role: "assistant",
        content: replyText,
        actionsJson: actions.length ? JSON.stringify(actions) : null,
      },
    });

    return { id: saved.id, role: "assistant", content: replyText, actions, createdAt: saved.createdAt.toISOString() };
  });

  app.delete("/ai/messages", async (request, reply) => {
    const { workspaceId } = request.user;
    await prisma.aiMessage.deleteMany({ where: { workspaceId } });
    return reply.code(204).send();
  });
}
