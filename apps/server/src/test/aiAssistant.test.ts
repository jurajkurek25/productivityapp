import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { authHeaders, createTestApp, registerTestUser } from "./helpers.js";

const mockCreate = vi.hoisted(() => vi.fn());

vi.mock("@anthropic-ai/sdk", () => ({
  default: vi.fn().mockImplementation(() => ({ messages: { create: mockCreate } })),
}));

// A real ANTHROPIC_API_KEY is required only to make aiAssistant.ts construct
// a client at all — the SDK itself is mocked above, so no real network call
// or billing ever happens in this suite.
process.env.ANTHROPIC_API_KEY = "test-key";

describe("AI assistant — tool-calling flow (mocked Anthropic SDK)", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await createTestApp();
    mockCreate.mockReset();
  });

  afterEach(async () => {
    await app.close();
  });

  it("creates a goal and a step from a single chat turn and persists both messages", async () => {
    // The step's goalId isn't known until the goal-creation tool result comes
    // back, so the second turn is derived from the previous tool_result
    // instead of being hardcoded — mirrors what the real model would do.
    let callCount = 0;
    mockCreate.mockImplementation(async (params: { messages: { content: unknown }[] }) => {
      callCount++;
      if (callCount === 1) {
        return {
          content: [
            {
              type: "tool_use",
              id: "toolu_goal",
              name: "create_goal",
              input: { domain: "study", title: "Naučiť sa po španielsky" },
            },
          ],
        };
      }
      if (callCount === 2) {
        const lastMessage = params.messages[params.messages.length - 1];
        const toolResultBlock = (lastMessage.content as { type: string; content: string }[]).find(
          (b) => b.type === "tool_result"
        )!;
        const created = JSON.parse(toolResultBlock.content) as { id: string };
        return {
          content: [
            {
              type: "tool_use",
              id: "toolu_step",
              name: "create_step",
              input: { goalId: created.id, title: "Denná lekcia", estimatedMinutes: 15, freq: "daily" },
            },
          ],
        };
      }
      return { content: [{ type: "text", text: "Pridal som cieľ Naučiť sa po španielsky s denným krokom." }] };
    });

    const user = await registerTestUser(app);

    const res = await app.inject({
      method: "POST",
      url: "/api/ai/chat",
      headers: authHeaders(user.token),
      payload: { message: "Chcem sa naučiť po španielsky, 15 minút denne." },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.content).toContain("Naučiť sa po španielsky");
    expect(body.actions).toHaveLength(2);
    expect(body.actions[0]).toMatchObject({ type: "create_goal", title: "Naučiť sa po španielsky" });
    expect(body.actions[1]).toMatchObject({ type: "create_step", title: "Denná lekcia" });

    // Verify persistence: both the user's message and the assistant's reply are stored.
    const historyRes = await app.inject({ method: "GET", url: "/api/ai/messages", headers: authHeaders(user.token) });
    const history = historyRes.json();
    expect(history).toHaveLength(2);
    expect(history[0].role).toBe("user");
    expect(history[1].role).toBe("assistant");
    expect(history[1].actions).toHaveLength(2);
  });

  it("answers with plain text and no actions when no tool is needed", async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: "text", text: "Ako sa dnes cítiš a čo by si chcel/a dosiahnuť?" }],
    });

    const user = await registerTestUser(app);
    const res = await app.inject({
      method: "POST",
      url: "/api/ai/chat",
      headers: authHeaders(user.token),
      payload: { message: "Ahoj" },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.content).toContain("cítiš");
    expect(body.actions).toHaveLength(0);
  });

  it("scopes chat history to the caller's own workspace", async () => {
    mockCreate.mockResolvedValueOnce({ content: [{ type: "text", text: "Ahoj!" }] });
    const owner = await registerTestUser(app, { email: "owner-ai@example.com" });
    const stranger = await registerTestUser(app, { email: "stranger-ai@example.com" });

    await app.inject({
      method: "POST",
      url: "/api/ai/chat",
      headers: authHeaders(owner.token),
      payload: { message: "Ahoj" },
    });

    const strangerHistory = await app.inject({
      method: "GET",
      url: "/api/ai/messages",
      headers: authHeaders(stranger.token),
    });
    expect(strangerHistory.json()).toHaveLength(0);
  });

  it("returns a generic 502 (no leaked SDK details) when the Anthropic call fails", async () => {
    mockCreate.mockRejectedValueOnce(new Error("401 authentication_error: API key is invalid."));
    const user = await registerTestUser(app);

    const res = await app.inject({
      method: "POST",
      url: "/api/ai/chat",
      headers: authHeaders(user.token),
      payload: { message: "Ahoj" },
    });

    expect(res.statusCode).toBe(502);
    expect(res.json().error).not.toContain("API key");
  });

  it("clears chat history on DELETE /ai/messages", async () => {
    mockCreate.mockResolvedValueOnce({ content: [{ type: "text", text: "Ahoj!" }] });
    const user = await registerTestUser(app);
    await app.inject({
      method: "POST",
      url: "/api/ai/chat",
      headers: authHeaders(user.token),
      payload: { message: "Ahoj" },
    });

    const del = await app.inject({ method: "DELETE", url: "/api/ai/messages", headers: authHeaders(user.token) });
    expect(del.statusCode).toBe(204);

    const historyRes = await app.inject({ method: "GET", url: "/api/ai/messages", headers: authHeaders(user.token) });
    expect(historyRes.json()).toHaveLength(0);
  });
});
