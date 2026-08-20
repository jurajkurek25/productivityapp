import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { authHeaders, createTestApp, registerTestUser } from "./helpers.js";

describe("workspace", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await createTestApp();
  });

  afterEach(async () => {
    await app.close();
  });

  describe("capacity", () => {
    it("returns the default template when nothing was ever saved", async () => {
      const user = await registerTestUser(app);
      const res = await app.inject({ method: "GET", url: "/api/workspace/capacity", headers: authHeaders(user.token) });
      expect(res.statusCode).toBe(200);
      expect(res.json().days).toHaveLength(7);
    });

    it("round-trips a saved template", async () => {
      const user = await registerTestUser(app);
      const headers = authHeaders(user.token);
      const days = Array.from({ length: 7 }, () => ({ study: 45, business: 90, social: 20, relax: 40 }));

      const put = await app.inject({ method: "PUT", url: "/api/workspace/capacity", headers, payload: { days } });
      expect(put.statusCode).toBe(200);

      const get = await app.inject({ method: "GET", url: "/api/workspace/capacity", headers });
      expect(get.json().days[1].business).toBe(90);
    });

    it("rejects a template with the wrong number of days", async () => {
      const user = await registerTestUser(app);
      const res = await app.inject({
        method: "PUT",
        url: "/api/workspace/capacity",
        headers: authHeaders(user.token),
        payload: { days: [{ study: 10, business: 10, social: 10, relax: 10 }] },
      });
      expect(res.statusCode).toBe(400);
    });
  });

  describe("export", () => {
    it("requires authentication", async () => {
      const res = await app.inject({ method: "GET", url: "/api/workspace/export" });
      expect(res.statusCode).toBe(401);
    });

    it("includes goals, steps, and task instances for the caller's workspace only", async () => {
      const owner = await registerTestUser(app, { email: "owner@example.com", name: "Owner" });
      const stranger = await registerTestUser(app, { email: "stranger@example.com" });

      await app.inject({
        method: "POST",
        url: "/api/goals",
        headers: authHeaders(owner.token),
        payload: { domain: "business", title: "Owner goal" },
      });
      await app.inject({
        method: "POST",
        url: "/api/calendar/quick",
        headers: authHeaders(owner.token),
        payload: { title: "Owner task", domain: "business", durationMinutes: 20 },
      });

      const ownerExport = await app.inject({ method: "GET", url: "/api/workspace/export", headers: authHeaders(owner.token) });
      expect(ownerExport.statusCode).toBe(200);
      const body = ownerExport.json();
      expect(body.goals.length).toBeGreaterThanOrEqual(1);
      expect(body.taskInstances.length).toBeGreaterThanOrEqual(1);
      expect(body.weeklyCapacity.days).toHaveLength(7);

      const strangerExport = await app.inject({
        method: "GET",
        url: "/api/workspace/export",
        headers: authHeaders(stranger.token),
      });
      expect(strangerExport.json().goals).toHaveLength(0);
      expect(strangerExport.json().taskInstances).toHaveLength(0);
    });
  });
});
