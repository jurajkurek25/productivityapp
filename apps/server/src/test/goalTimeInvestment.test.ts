import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";
import { authHeaders, createTestApp, registerTestUser } from "./helpers.js";

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

describe("goal time investment", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await createTestApp();
  });

  afterEach(async () => {
    await app.close();
  });

  async function createGoal(token: string, title: string) {
    const res = await app.inject({
      method: "POST",
      url: "/api/goals",
      headers: authHeaders(token),
      payload: { domain: "business", title },
    });
    return res.json();
  }

  async function addInstance(workspaceId: string, goalId: string, minutes: number, status: "completed" | "scheduled") {
    const step = await prisma.step.create({
      data: {
        workspaceId,
        goalId,
        domain: "business",
        title: "Step",
        estimatedMinutes: minutes,
        recurrenceFreq: "once",
        status: "active",
      },
    });
    return prisma.taskInstance.create({
      data: {
        workspaceId,
        stepId: step.id,
        goalId,
        domain: "business",
        title: "Instance",
        scheduledDate: todayISO(),
        durationMinutes: minutes,
        status,
        completedAt: status === "completed" ? new Date() : null,
      },
    });
  }

  it("requires authentication", async () => {
    const res = await app.inject({ method: "GET", url: "/api/goals/time-investment" });
    expect(res.statusCode).toBe(401);
  });

  it("aggregates minutes per goal and sorts by scheduled minutes descending", async () => {
    const user = await registerTestUser(app);
    const busyGoal = await createGoal(user.token, "Busy goal");
    const quietGoal = await createGoal(user.token, "Quiet goal");
    const idleGoal = await createGoal(user.token, "Idle goal");

    await addInstance(user.workspaceId, busyGoal.id, 90, "completed");
    await addInstance(user.workspaceId, busyGoal.id, 30, "scheduled");
    await addInstance(user.workspaceId, quietGoal.id, 20, "completed");
    void idleGoal;

    const res = await app.inject({ method: "GET", url: "/api/goals/time-investment", headers: authHeaders(user.token) });
    expect(res.statusCode).toBe(200);
    const body = res.json();

    // idleGoal had no activity in the window -> excluded entirely.
    expect(body).toHaveLength(2);
    expect(body[0].goalId).toBe(busyGoal.id);
    expect(body[0].scheduledMinutes).toBe(120);
    expect(body[0].completedMinutes).toBe(90);
    expect(body[0].completionRate).toBeCloseTo(0.75);
    expect(body[1].goalId).toBe(quietGoal.id);
    expect(body[1].scheduledMinutes).toBe(20);
  });

  it("scopes results to the caller's own workspace", async () => {
    const owner = await registerTestUser(app, { email: "owner@example.com" });
    const stranger = await registerTestUser(app, { email: "stranger@example.com" });
    const goal = await createGoal(owner.token, "Owner goal");
    await addInstance(owner.workspaceId, goal.id, 45, "completed");

    const res = await app.inject({
      method: "GET",
      url: "/api/goals/time-investment",
      headers: authHeaders(stranger.token),
    });
    expect(res.json()).toHaveLength(0);
  });
});
