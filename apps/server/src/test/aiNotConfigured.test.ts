import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { authHeaders, createTestApp, registerTestUser } from "./helpers.js";

// No ANTHROPIC_API_KEY is set anywhere in the test env (vitest.config.ts).
// Explicitly unset it here too, in case another test file in the same
// worker process (e.g. aiAssistant.test.ts, which mocks the SDK and needs a
// key present) set it as a module-level side effect — process.env is a real
// global, not isolated per test file the way module state is.
delete process.env.ANTHROPIC_API_KEY;

describe("AI assistant — not configured", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await createTestApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it("reports configured: false", async () => {
    const user = await registerTestUser(app);
    const res = await app.inject({ method: "GET", url: "/api/ai/status", headers: authHeaders(user.token) });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ configured: false });
  });

  it("rejects chat requests with a clear 503 instead of crashing", async () => {
    const user = await registerTestUser(app);
    const res = await app.inject({
      method: "POST",
      url: "/api/ai/chat",
      headers: authHeaders(user.token),
      payload: { message: "Ahoj" },
    });
    expect(res.statusCode).toBe(503);
    expect(res.json().error).toContain("ANTHROPIC_API_KEY");
  });
});
