import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { authHeaders, createTestApp, registerTestUser } from "./helpers.js";

describe("goals + steps", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await createTestApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it("requires authentication", async () => {
    const res = await app.inject({ method: "GET", url: "/api/goals" });
    expect(res.statusCode).toBe(401);
  });

  it("runs the full goal + step lifecycle", async () => {
    const user = await registerTestUser(app);
    const headers = authHeaders(user.token);

    const createGoal = await app.inject({
      method: "POST",
      url: "/api/goals",
      headers,
      payload: { domain: "business", title: "Launch a podcast" },
    });
    expect(createGoal.statusCode).toBe(201);
    const goal = createGoal.json();
    expect(goal.title).toBe("Launch a podcast");

    const createStep = await app.inject({
      method: "POST",
      url: "/api/steps",
      headers,
      payload: {
        goalId: goal.id,
        domain: "business",
        title: "Record episode 1",
        estimatedMinutes: 60,
        recurrence: { freq: "once" },
      },
    });
    expect(createStep.statusCode).toBe(201);
    const step = createStep.json();

    const getGoal = await app.inject({ method: "GET", url: `/api/goals/${goal.id}`, headers });
    expect(getGoal.statusCode).toBe(200);
    expect(getGoal.json().steps).toHaveLength(1);
    expect(getGoal.json().steps[0].id).toBe(step.id);

    const updateStep = await app.inject({
      method: "PATCH",
      url: `/api/steps/${step.id}`,
      headers,
      payload: { status: "done" },
    });
    expect(updateStep.statusCode).toBe(200);
    expect(updateStep.json().status).toBe("done");

    const deleteGoal = await app.inject({ method: "DELETE", url: `/api/goals/${goal.id}`, headers });
    expect(deleteGoal.statusCode).toBe(204);

    const getMissing = await app.inject({ method: "GET", url: `/api/goals/${goal.id}`, headers });
    expect(getMissing.statusCode).toBe(404);
  });

  it("scopes goals to the owning workspace", async () => {
    const owner = await registerTestUser(app, { email: "owner@example.com" });
    const intruder = await registerTestUser(app, { email: "intruder@example.com" });

    const created = await app.inject({
      method: "POST",
      url: "/api/goals",
      headers: authHeaders(owner.token),
      payload: { domain: "study", title: "Owner's private goal" },
    });
    const goal = created.json();

    const listAsIntruder = await app.inject({ method: "GET", url: "/api/goals", headers: authHeaders(intruder.token) });
    expect(listAsIntruder.json()).toHaveLength(0);

    const getAsIntruder = await app.inject({
      method: "GET",
      url: `/api/goals/${goal.id}`,
      headers: authHeaders(intruder.token),
    });
    expect(getAsIntruder.statusCode).toBe(404);

    const deleteAsIntruder = await app.inject({
      method: "DELETE",
      url: `/api/goals/${goal.id}`,
      headers: authHeaders(intruder.token),
    });
    expect(deleteAsIntruder.statusCode).toBe(404);
  });

  it("round-trips weeklyTargetMinutes through create and update", async () => {
    const user = await registerTestUser(app);
    const headers = authHeaders(user.token);

    const created = await app.inject({
      method: "POST",
      url: "/api/goals",
      headers,
      payload: { domain: "business", title: "Learn guitar", weeklyTargetMinutes: 180 },
    });
    expect(created.statusCode).toBe(201);
    const goal = created.json();
    expect(goal.weeklyTargetMinutes).toBe(180);

    const updated = await app.inject({
      method: "PATCH",
      url: `/api/goals/${goal.id}`,
      headers,
      payload: { weeklyTargetMinutes: 240 },
    });
    expect(updated.statusCode).toBe(200);
    expect(updated.json().weeklyTargetMinutes).toBe(240);
  });

  it("returns rule-based suggested steps for a goal", async () => {
    const user = await registerTestUser(app);
    const created = await app.inject({
      method: "POST",
      url: "/api/goals",
      headers: authHeaders(user.token),
      payload: { domain: "business", title: "Rozbehnúť YouTube kanál" },
    });
    const goal = created.json();

    const res = await app.inject({
      method: "GET",
      url: `/api/goals/${goal.id}/suggest-steps`,
      headers: authHeaders(user.token),
    });
    expect(res.statusCode).toBe(200);
    const suggestions = res.json();
    expect(Array.isArray(suggestions)).toBe(true);
    expect(suggestions.length).toBeGreaterThan(0);
  });
});
