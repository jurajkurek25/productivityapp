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

describe("estimate accuracy", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await createTestApp();
  });

  afterEach(async () => {
    await app.close();
  });

  async function createGoal(token: string, domain: string) {
    const res = await app.inject({
      method: "POST",
      url: "/api/goals",
      headers: authHeaders(token),
      payload: { domain, title: "Goal" },
    });
    return res.json();
  }

  async function createStep(workspaceId: string, goalId: string, domain: string, estimatedMinutes: number) {
    return prisma.step.create({
      data: { workspaceId, goalId, domain, title: "Step", estimatedMinutes, recurrenceFreq: "once", status: "active" },
    });
  }

  async function completeInstance(workspaceId: string, goalId: string, stepId: string, domain: string, durationMinutes: number) {
    return prisma.taskInstance.create({
      data: {
        workspaceId,
        stepId,
        goalId,
        domain,
        title: "Instance",
        scheduledDate: todayISO(),
        durationMinutes,
        status: "completed",
        completedAt: new Date(),
      },
    });
  }

  it("reports a positive bias when tasks consistently take longer than estimated", async () => {
    const user = await registerTestUser(app);
    const goal = await createGoal(user.token, "study");
    for (let i = 0; i < 3; i++) {
      const step = await createStep(user.workspaceId, goal.id, "study", 30);
      await completeInstance(user.workspaceId, goal.id, step.id, "study", 45);
    }

    const res = await app.inject({
      method: "GET",
      url: "/api/workspace/estimate-accuracy",
      headers: authHeaders(user.token),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveLength(1);
    expect(body[0].domain).toBe("study");
    expect(body[0].sampleSize).toBe(3);
    expect(body[0].biasPercent).toBe(50);
  });

  it("reports a negative bias when tasks consistently finish faster than estimated", async () => {
    const user = await registerTestUser(app);
    const goal = await createGoal(user.token, "business");
    for (let i = 0; i < 3; i++) {
      const step = await createStep(user.workspaceId, goal.id, "business", 60);
      await completeInstance(user.workspaceId, goal.id, step.id, "business", 30);
    }

    const res = await app.inject({
      method: "GET",
      url: "/api/workspace/estimate-accuracy",
      headers: authHeaders(user.token),
    });
    const body = res.json();
    expect(body[0].biasPercent).toBe(-50);
  });

  it("omits domains with too few completed instances to be meaningful", async () => {
    const user = await registerTestUser(app);
    const goal = await createGoal(user.token, "social");
    const step = await createStep(user.workspaceId, goal.id, "social", 20);
    await completeInstance(user.workspaceId, goal.id, step.id, "social", 40);

    const res = await app.inject({
      method: "GET",
      url: "/api/workspace/estimate-accuracy",
      headers: authHeaders(user.token),
    });
    expect(res.json()).toHaveLength(0);
  });

  it("excludes completed instances outside the requested window", async () => {
    const user = await registerTestUser(app);
    const goal = await createGoal(user.token, "relax");
    for (let i = 0; i < 3; i++) {
      const step = await createStep(user.workspaceId, goal.id, "relax", 20);
      const inst = await completeInstance(user.workspaceId, goal.id, step.id, "relax", 40);
      await prisma.taskInstance.update({ where: { id: inst.id }, data: { scheduledDate: addDays(todayISO(), -200) } });
    }

    const res = await app.inject({
      method: "GET",
      url: "/api/workspace/estimate-accuracy?windowDays=90",
      headers: authHeaders(user.token),
    });
    expect(res.json()).toHaveLength(0);
  });
});
