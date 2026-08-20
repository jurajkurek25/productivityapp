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

describe("goal progress", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await createTestApp();
  });

  afterEach(async () => {
    await app.close();
  });

  async function createGoal(token: string, targetDate?: string, weeklyTargetMinutes?: number) {
    const res = await app.inject({
      method: "POST",
      url: "/api/goals",
      headers: authHeaders(token),
      payload: { domain: "business", title: "Goal", targetDate, weeklyTargetMinutes },
    });
    return res.json();
  }

  async function createOnceStep(workspaceId: string, goalId: string, estimatedMinutes: number) {
    return prisma.step.create({
      data: {
        workspaceId,
        goalId,
        domain: "business",
        title: "Step",
        estimatedMinutes,
        recurrenceFreq: "once",
        status: "active",
      },
    });
  }

  async function completeInstance(workspaceId: string, goalId: string, stepId: string, scheduledDate: string, minutes: number) {
    return prisma.taskInstance.create({
      data: {
        workspaceId,
        stepId,
        goalId,
        domain: "business",
        title: "Instance",
        scheduledDate,
        durationMinutes: minutes,
        status: "completed",
        completedAt: new Date(),
      },
    });
  }

  it("reports no_deadline for a goal without a targetDate", async () => {
    const user = await registerTestUser(app);
    const goal = await createGoal(user.token);

    const res = await app.inject({
      method: "GET",
      url: `/api/goals/${goal.id}/progress`,
      headers: authHeaders(user.token),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe("no_deadline");
  });

  it("reports no_planned_work for a goal made only of recurring (habit) steps", async () => {
    const user = await registerTestUser(app);
    const goal = await createGoal(user.token, addDays(todayISO(), 30));
    await prisma.step.create({
      data: {
        workspaceId: user.workspaceId,
        goalId: goal.id,
        domain: "business",
        title: "Daily habit",
        estimatedMinutes: 20,
        recurrenceFreq: "daily",
        status: "active",
      },
    });

    const res = await app.inject({
      method: "GET",
      url: `/api/goals/${goal.id}/progress`,
      headers: authHeaders(user.token),
    });
    expect(res.json().status).toBe("no_planned_work");
  });

  it("reports on_track once all planned work is completed", async () => {
    const user = await registerTestUser(app);
    const goal = await createGoal(user.token, addDays(todayISO(), 30));
    const step = await createOnceStep(user.workspaceId, goal.id, 60);
    await completeInstance(user.workspaceId, goal.id, step.id, todayISO(), 60);

    const res = await app.inject({
      method: "GET",
      url: `/api/goals/${goal.id}/progress`,
      headers: authHeaders(user.token),
    });
    const body = res.json();
    expect(body.status).toBe("on_track");
    expect(body.remainingMinutes).toBe(0);
    expect(body.totalCompletedMinutes).toBe(60);
  });

  it("reports behind when the deadline has already passed with work remaining", async () => {
    const user = await registerTestUser(app);
    const goal = await createGoal(user.token, addDays(todayISO(), -1));
    await createOnceStep(user.workspaceId, goal.id, 120);

    const res = await app.inject({
      method: "GET",
      url: `/api/goals/${goal.id}/progress`,
      headers: authHeaders(user.token),
    });
    const body = res.json();
    expect(body.status).toBe("behind");
    expect(body.remainingMinutes).toBe(120);
  });

  it("reports behind when recent pace won't cover the remaining work before the deadline", async () => {
    const user = await registerTestUser(app);
    const goal = await createGoal(user.token, addDays(todayISO(), 3));
    await createOnceStep(user.workspaceId, goal.id, 500);
    // No completed instances at all -> zero pace, deadline in 3 days, 500 min remaining.

    const res = await app.inject({
      method: "GET",
      url: `/api/goals/${goal.id}/progress`,
      headers: authHeaders(user.token),
    });
    expect(res.json().status).toBe("behind");
  });

  it("reports on_track when recent pace projects enough time before the deadline", async () => {
    const user = await registerTestUser(app);
    const goal = await createGoal(user.token, addDays(todayISO(), 30));
    const remainingStep = await createOnceStep(user.workspaceId, goal.id, 60);
    const doneStep = await createOnceStep(user.workspaceId, goal.id, 100);
    // Completed 100 min within the last 14 days -> ~7/day pace * 30 days remaining >> 60 min remaining.
    await completeInstance(user.workspaceId, goal.id, doneStep.id, addDays(todayISO(), -2), 100);
    void remainingStep;

    const res = await app.inject({
      method: "GET",
      url: `/api/goals/${goal.id}/progress`,
      headers: authHeaders(user.token),
    });
    const body = res.json();
    expect(body.status).toBe("on_track");
    expect(body.remainingMinutes).toBe(60);
  });

  it("scopes progress to the caller's own workspace", async () => {
    const owner = await registerTestUser(app, { email: "owner@example.com" });
    const stranger = await registerTestUser(app, { email: "stranger@example.com" });
    const goal = await createGoal(owner.token, addDays(todayISO(), 10));

    const res = await app.inject({
      method: "GET",
      url: `/api/goals/${goal.id}/progress`,
      headers: authHeaders(stranger.token),
    });
    expect(res.statusCode).toBe(404);
  });

  describe("weekly target", () => {
    it("reports null weekly fields when no weekly target is set", async () => {
      const user = await registerTestUser(app);
      const goal = await createGoal(user.token);

      const res = await app.inject({
        method: "GET",
        url: `/api/goals/${goal.id}/progress`,
        headers: authHeaders(user.token),
      });
      const body = res.json();
      expect(body.weeklyTargetMinutes).toBeNull();
      expect(body.weeklyTargetMet).toBeNull();
      expect(body.currentWeekMinutes).toBe(0);
    });

    it("reports weeklyTargetMet=true once this week's completed minutes reach the target", async () => {
      const user = await registerTestUser(app);
      const goal = await createGoal(user.token, undefined, 90);
      const step = await createOnceStep(user.workspaceId, goal.id, 200);
      await completeInstance(user.workspaceId, goal.id, step.id, todayISO(), 100);

      const res = await app.inject({
        method: "GET",
        url: `/api/goals/${goal.id}/progress`,
        headers: authHeaders(user.token),
      });
      const body = res.json();
      expect(body.weeklyTargetMinutes).toBe(90);
      expect(body.currentWeekMinutes).toBe(100);
      expect(body.weeklyTargetMet).toBe(true);
    });

    it("reports weeklyTargetMet=false when this week falls short and ignores minutes from before this week", async () => {
      const user = await registerTestUser(app);
      const goal = await createGoal(user.token, undefined, 180);
      const step = await createOnceStep(user.workspaceId, goal.id, 500);
      await completeInstance(user.workspaceId, goal.id, step.id, addDays(todayISO(), -30), 400);

      const res = await app.inject({
        method: "GET",
        url: `/api/goals/${goal.id}/progress`,
        headers: authHeaders(user.token),
      });
      const body = res.json();
      expect(body.weeklyTargetMinutes).toBe(180);
      expect(body.currentWeekMinutes).toBe(0);
      expect(body.weeklyTargetMet).toBe(false);
    });
  });

  describe("progress-summary", () => {
    it("lists only active goals that are behind pace", async () => {
      const user = await registerTestUser(app);
      const behindGoal = await createGoal(user.token, addDays(todayISO(), -1));
      await createOnceStep(user.workspaceId, behindGoal.id, 60);

      const onTrackGoal = await createGoal(user.token, addDays(todayISO(), 30));
      const step = await createOnceStep(user.workspaceId, onTrackGoal.id, 60);
      await completeInstance(user.workspaceId, onTrackGoal.id, step.id, todayISO(), 60);

      const noDeadlineGoal = await createGoal(user.token);
      await createOnceStep(user.workspaceId, noDeadlineGoal.id, 60);
      void noDeadlineGoal;

      const res = await app.inject({
        method: "GET",
        url: "/api/goals/progress-summary",
        headers: authHeaders(user.token),
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body).toHaveLength(1);
      expect(body[0].goalId).toBe(behindGoal.id);
    });
  });
});
