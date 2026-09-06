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

describe("today focus (Eisenhower quadrants)", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await createTestApp();
  });

  afterEach(async () => {
    await app.close();
  });

  async function createGoal(token: string, targetDate?: string) {
    const res = await app.inject({
      method: "POST",
      url: "/api/goals",
      headers: authHeaders(token),
      payload: { domain: "business", title: "Goal", targetDate },
    });
    return res.json();
  }

  async function createStep(workspaceId: string, goalId: string, priority: number) {
    return prisma.step.create({
      data: { workspaceId, goalId, domain: "business", title: "Step", estimatedMinutes: 30, priority, recurrenceFreq: "once", status: "active" },
    });
  }

  async function createInstance(
    workspaceId: string,
    goalId: string,
    stepId: string,
    opts: { rescheduledFrom?: string } = {}
  ) {
    return prisma.taskInstance.create({
      data: {
        workspaceId,
        stepId,
        goalId,
        domain: "business",
        title: "Instance",
        scheduledDate: todayISO(),
        durationMinutes: 30,
        status: "scheduled",
        rescheduledFrom: opts.rescheduledFrom,
      },
    });
  }

  it("classifies an important task with a near deadline as do_now", async () => {
    const user = await registerTestUser(app);
    const goal = await createGoal(user.token, addDays(todayISO(), 3));
    const step = await createStep(user.workspaceId, goal.id, 5);
    await createInstance(user.workspaceId, goal.id, step.id);

    const res = await app.inject({ method: "GET", url: "/api/calendar/today-focus", headers: authHeaders(user.token) });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveLength(1);
    expect(body[0].quadrant).toBe("do_now");
  });

  it("classifies an important task with a distant/no deadline as protect_time", async () => {
    const user = await registerTestUser(app);
    const goal = await createGoal(user.token);
    const step = await createStep(user.workspaceId, goal.id, 5);
    await createInstance(user.workspaceId, goal.id, step.id);

    const res = await app.inject({ method: "GET", url: "/api/calendar/today-focus", headers: authHeaders(user.token) });
    expect(res.json()[0].quadrant).toBe("protect_time");
  });

  it("classifies a low-priority recovered (rescheduled) task as quick_win", async () => {
    const user = await registerTestUser(app);
    const goal = await createGoal(user.token);
    const step = await createStep(user.workspaceId, goal.id, 2);
    await createInstance(user.workspaceId, goal.id, step.id, { rescheduledFrom: addDays(todayISO(), -1) });

    const res = await app.inject({ method: "GET", url: "/api/calendar/today-focus", headers: authHeaders(user.token) });
    expect(res.json()[0].quadrant).toBe("quick_win");
  });

  it("classifies a low-priority task with a distant deadline as reconsider", async () => {
    const user = await registerTestUser(app);
    const goal = await createGoal(user.token, addDays(todayISO(), 60));
    const step = await createStep(user.workspaceId, goal.id, 2);
    await createInstance(user.workspaceId, goal.id, step.id);

    const res = await app.inject({ method: "GET", url: "/api/calendar/today-focus", headers: authHeaders(user.token) });
    expect(res.json()[0].quadrant).toBe("reconsider");
  });

  it("excludes already-completed instances and scopes to the caller's workspace", async () => {
    const owner = await registerTestUser(app, { email: "owner-focus@example.com" });
    const stranger = await registerTestUser(app, { email: "stranger-focus@example.com" });
    const goal = await createGoal(owner.token);
    const step = await createStep(owner.workspaceId, goal.id, 5);
    const inst = await createInstance(owner.workspaceId, goal.id, step.id);
    await prisma.taskInstance.update({ where: { id: inst.id }, data: { status: "completed" } });

    const ownerRes = await app.inject({ method: "GET", url: "/api/calendar/today-focus", headers: authHeaders(owner.token) });
    expect(ownerRes.json()).toHaveLength(0);

    const strangerRes = await app.inject({ method: "GET", url: "/api/calendar/today-focus", headers: authHeaders(stranger.token) });
    expect(strangerRes.json()).toHaveLength(0);
  });
});
