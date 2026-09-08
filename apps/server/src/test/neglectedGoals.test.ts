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

describe("neglected goals", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await createTestApp();
  });

  afterEach(async () => {
    await app.close();
  });

  async function createGoal(token: string, title: string, status: "active" | "paused" = "active") {
    const res = await app.inject({
      method: "POST",
      url: "/api/goals",
      headers: authHeaders(token),
      payload: { domain: "business", title },
    });
    const goal = res.json();
    if (status !== "active") {
      await prisma.goal.update({ where: { id: goal.id }, data: { status } });
    }
    return goal;
  }

  async function backdateGoal(goalId: string, daysAgo: number) {
    await prisma.goal.update({
      where: { id: goalId },
      data: { createdAt: new Date(Date.now() - daysAgo * 86_400_000) },
    });
  }

  async function completeInstance(workspaceId: string, goalId: string, scheduledDate: string) {
    const step = await prisma.step.create({
      data: {
        workspaceId,
        goalId,
        domain: "business",
        title: "Step",
        estimatedMinutes: 30,
        recurrenceFreq: "once",
        status: "active",
      },
    });
    await prisma.taskInstance.create({
      data: {
        workspaceId,
        stepId: step.id,
        goalId,
        domain: "business",
        title: "Instance",
        scheduledDate,
        durationMinutes: 30,
        status: "completed",
        completedAt: new Date(),
      },
    });
  }

  it("requires authentication", async () => {
    const res = await app.inject({ method: "GET", url: "/api/goals/neglected" });
    expect(res.statusCode).toBe(401);
  });

  it("includes an old goal that has never had any completed activity", async () => {
    const user = await registerTestUser(app);
    const goal = await createGoal(user.token, "Untouched goal");
    await backdateGoal(goal.id, 30);

    const res = await app.inject({ method: "GET", url: "/api/goals/neglected", headers: authHeaders(user.token) });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveLength(1);
    expect(body[0].goalId).toBe(goal.id);
    expect(body[0].daysSinceLastActivity).toBeNull();
  });

  it("includes an old goal whose last completed activity is outside the window", async () => {
    const user = await registerTestUser(app);
    const goal = await createGoal(user.token, "Stale goal");
    await backdateGoal(goal.id, 30);
    await completeInstance(user.workspaceId, goal.id, addDays(todayISO(), -20));

    const res = await app.inject({ method: "GET", url: "/api/goals/neglected", headers: authHeaders(user.token) });
    const body = res.json();
    expect(body).toHaveLength(1);
    expect(body[0].daysSinceLastActivity).toBe(20);
  });

  it("excludes a goal with recent completed activity", async () => {
    const user = await registerTestUser(app);
    const goal = await createGoal(user.token, "Active goal");
    await backdateGoal(goal.id, 30);
    await completeInstance(user.workspaceId, goal.id, addDays(todayISO(), -2));

    const res = await app.inject({ method: "GET", url: "/api/goals/neglected", headers: authHeaders(user.token) });
    expect(res.json()).toHaveLength(0);
  });

  it("excludes a goal that is too new to judge, even with zero activity", async () => {
    const user = await registerTestUser(app);
    await createGoal(user.token, "Brand new goal");
    // No backdating -> created "now", well within the 14-day window.

    const res = await app.inject({ method: "GET", url: "/api/goals/neglected", headers: authHeaders(user.token) });
    expect(res.json()).toHaveLength(0);
  });

  it("excludes non-active goals", async () => {
    const user = await registerTestUser(app);
    const goal = await createGoal(user.token, "Paused goal", "paused");
    await backdateGoal(goal.id, 30);

    const res = await app.inject({ method: "GET", url: "/api/goals/neglected", headers: authHeaders(user.token) });
    expect(res.json()).toHaveLength(0);
  });

  it("scopes results to the caller's own workspace", async () => {
    const owner = await registerTestUser(app, { email: "owner@example.com" });
    const stranger = await registerTestUser(app, { email: "stranger@example.com" });
    const goal = await createGoal(owner.token, "Owner goal");
    await backdateGoal(goal.id, 30);

    const res = await app.inject({ method: "GET", url: "/api/goals/neglected", headers: authHeaders(stranger.token) });
    expect(res.json()).toHaveLength(0);
  });
});
