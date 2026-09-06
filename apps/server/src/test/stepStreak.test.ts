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

describe("step streaks", () => {
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
      payload: { domain: "relax", title: "Habits" },
    });
    return res.json();
  }

  async function createRecurringStep(workspaceId: string, goalId: string, freq: "daily" | "weekly" | "monthly" = "daily") {
    return prisma.step.create({
      data: {
        workspaceId,
        goalId,
        domain: "relax",
        title: "Meditácia",
        estimatedMinutes: 15,
        recurrenceFreq: freq,
        status: "active",
      },
    });
  }

  async function createInstance(workspaceId: string, goalId: string, stepId: string, scheduledDate: string, status: string) {
    return prisma.taskInstance.create({
      data: {
        workspaceId,
        stepId,
        goalId,
        domain: "relax",
        title: "Meditácia",
        scheduledDate,
        durationMinutes: 15,
        status,
        completedAt: status === "completed" ? new Date() : null,
      },
    });
  }

  it("counts consecutive completed occurrences, skipping today's still-open one", async () => {
    const user = await registerTestUser(app);
    const goal = await createGoal(user.token);
    const step = await createRecurringStep(user.workspaceId, goal.id);

    await createInstance(user.workspaceId, goal.id, step.id, addDays(todayISO(), -1), "completed");
    await createInstance(user.workspaceId, goal.id, step.id, addDays(todayISO(), -2), "completed");
    await createInstance(user.workspaceId, goal.id, step.id, addDays(todayISO(), -3), "completed");
    await createInstance(user.workspaceId, goal.id, step.id, todayISO(), "scheduled");

    const res = await app.inject({
      method: "GET",
      url: `/api/steps/${step.id}/streak`,
      headers: authHeaders(user.token),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().streak).toBe(3);
  });

  it("breaks the streak at a missed occurrence", async () => {
    const user = await registerTestUser(app);
    const goal = await createGoal(user.token);
    const step = await createRecurringStep(user.workspaceId, goal.id);

    await createInstance(user.workspaceId, goal.id, step.id, addDays(todayISO(), -1), "completed");
    await createInstance(user.workspaceId, goal.id, step.id, addDays(todayISO(), -2), "completed");
    await createInstance(user.workspaceId, goal.id, step.id, addDays(todayISO(), -3), "missed");
    await createInstance(user.workspaceId, goal.id, step.id, addDays(todayISO(), -4), "completed");

    const res = await app.inject({
      method: "GET",
      url: `/api/steps/${step.id}/streak`,
      headers: authHeaders(user.token),
    });
    expect(res.json().streak).toBe(2);
  });

  it("returns 0 for a step with no completed occurrences yet", async () => {
    const user = await registerTestUser(app);
    const goal = await createGoal(user.token);
    const step = await createRecurringStep(user.workspaceId, goal.id);

    const res = await app.inject({
      method: "GET",
      url: `/api/steps/${step.id}/streak`,
      headers: authHeaders(user.token),
    });
    expect(res.json().streak).toBe(0);
  });

  it("scopes streak lookup to the caller's own workspace", async () => {
    const owner = await registerTestUser(app, { email: "owner-streak@example.com" });
    const stranger = await registerTestUser(app, { email: "stranger-streak@example.com" });
    const goal = await createGoal(owner.token);
    const step = await createRecurringStep(owner.workspaceId, goal.id);

    const res = await app.inject({
      method: "GET",
      url: `/api/steps/${step.id}/streak`,
      headers: authHeaders(stranger.token),
    });
    expect(res.statusCode).toBe(404);
  });

  describe("GET /steps/streaks", () => {
    it("lists active recurring steps with their streak, excluding once-off steps", async () => {
      const user = await registerTestUser(app);
      const goal = await createGoal(user.token);
      const habit = await createRecurringStep(user.workspaceId, goal.id);
      await createInstance(user.workspaceId, goal.id, habit.id, addDays(todayISO(), -1), "completed");

      await prisma.step.create({
        data: {
          workspaceId: user.workspaceId,
          goalId: goal.id,
          domain: "relax",
          title: "One-off task",
          estimatedMinutes: 30,
          recurrenceFreq: "once",
          status: "active",
        },
      });

      const res = await app.inject({
        method: "GET",
        url: "/api/steps/streaks",
        headers: authHeaders(user.token),
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body).toHaveLength(1);
      expect(body[0].stepId).toBe(habit.id);
      expect(body[0].streak).toBe(1);
    });
  });
});
