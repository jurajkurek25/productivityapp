import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";
import { authHeaders, createTestApp, registerTestUser } from "./helpers.js";

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDays(date: string, n: number): string {
  return new Date(new Date(date + "T00:00:00Z").getTime() + n * 86_400_000).toISOString().slice(0, 10);
}

describe("goal investment trend", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await createTestApp();
  });

  afterEach(async () => {
    await app.close();
  });

  async function createGoal(token: string) {
    const res = await app.inject({
      method: "POST",
      url: "/api/goals",
      headers: authHeaders(token),
      payload: { domain: "business", title: "Goal" },
    });
    return res.json();
  }

  async function addInstance(workspaceId: string, goalId: string, scheduledDate: string, minutes: number, status: "completed" | "scheduled" = "completed") {
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
        scheduledDate,
        durationMinutes: minutes,
        status,
        completedAt: status === "completed" ? new Date() : null,
      },
    });
  }

  it("requires authentication", async () => {
    const res = await app.inject({ method: "GET", url: "/api/goals/nonexistent/investment-trend" });
    expect(res.statusCode).toBe(401);
  });

  it("returns 404 for a goal that isn't the caller's", async () => {
    const owner = await registerTestUser(app, { email: "owner@example.com" });
    const stranger = await registerTestUser(app, { email: "stranger@example.com" });
    const goal = await createGoal(owner.token);

    const res = await app.inject({
      method: "GET",
      url: `/api/goals/${goal.id}/investment-trend`,
      headers: authHeaders(stranger.token),
    });
    expect(res.statusCode).toBe(404);
  });

  it("buckets completed minutes into the correct week and ignores non-completed instances", async () => {
    const user = await registerTestUser(app);
    const goal = await createGoal(user.token);

    // This week: 40 completed + 100 scheduled-but-not-completed (should not count).
    await addInstance(user.workspaceId, goal.id, todayISO(), 40, "completed");
    await addInstance(user.workspaceId, goal.id, todayISO(), 100, "scheduled");
    // Two weeks ago: 60 completed.
    await addInstance(user.workspaceId, goal.id, addDays(todayISO(), -14), 60, "completed");

    const res = await app.inject({
      method: "GET",
      url: `/api/goals/${goal.id}/investment-trend?weeks=4`,
      headers: authHeaders(user.token),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveLength(4);

    const totalAcrossWeeks = body.reduce((sum: number, p: { completedMinutes: number }) => sum + p.completedMinutes, 0);
    expect(totalAcrossWeeks).toBe(100); // 40 + 60, the 100 "scheduled" minutes never count

    const lastWeek = body[body.length - 1];
    expect(lastWeek.completedMinutes).toBe(40);
  });

  it("defaults to 8 weeks when unspecified", async () => {
    const user = await registerTestUser(app);
    const goal = await createGoal(user.token);

    const res = await app.inject({
      method: "GET",
      url: `/api/goals/${goal.id}/investment-trend`,
      headers: authHeaders(user.token),
    });
    expect(res.json()).toHaveLength(8);
  });
});
