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

describe("calendar", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await createTestApp();
  });

  afterEach(async () => {
    await app.close();
  });

  describe("quick-add", () => {
    it("creates a task for today by default, visible via GET /calendar", async () => {
      const user = await registerTestUser(app);
      const headers = authHeaders(user.token);

      const created = await app.inject({
        method: "POST",
        url: "/api/calendar/quick",
        headers,
        payload: { title: "Kúpiť mlieko", domain: "business", durationMinutes: 15 },
      });
      expect(created.statusCode).toBe(201);
      const instance = created.json();
      expect(instance.scheduledDate).toBe(todayISO());
      expect(instance.status).toBe("scheduled");

      const list = await app.inject({
        method: "GET",
        url: `/api/calendar?start=${todayISO()}&end=${todayISO()}`,
        headers,
      });
      expect(list.json()).toHaveLength(1);
    });

    it("reuses one inbox goal across multiple quick-add calls", async () => {
      const user = await registerTestUser(app);
      const headers = authHeaders(user.token);

      await app.inject({
        method: "POST",
        url: "/api/calendar/quick",
        headers,
        payload: { title: "First", domain: "business", durationMinutes: 15 },
      });
      await app.inject({
        method: "POST",
        url: "/api/calendar/quick",
        headers,
        payload: { title: "Second", domain: "relax", durationMinutes: 15 },
      });

      const goals = await app.inject({ method: "GET", url: "/api/goals", headers });
      expect(goals.json()).toHaveLength(1);
    });
  });

  describe("missed-count + reschedule-missed", () => {
    async function seedOverdueTask(workspaceId: string, goalId: string, scheduledDate: string) {
      const step = await prisma.step.create({
        data: {
          workspaceId,
          goalId,
          domain: "business",
          title: "Overdue step",
          estimatedMinutes: 30,
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
          title: "Overdue task",
          scheduledDate,
          durationMinutes: 30,
          status: "scheduled",
        },
      });
    }

    it("reports 0 with no overdue tasks", async () => {
      const user = await registerTestUser(app);
      const res = await app.inject({ method: "GET", url: "/api/calendar/missed-count", headers: authHeaders(user.token) });
      expect(res.json().count).toBe(0);
    });

    it("counts a task still 'scheduled' with a past date as missed", async () => {
      const user = await registerTestUser(app);
      const goal = (
        await app.inject({
          method: "POST",
          url: "/api/goals",
          headers: authHeaders(user.token),
          payload: { domain: "business", title: "Goal" },
        })
      ).json();
      await seedOverdueTask(user.workspaceId, goal.id, addDays(todayISO(), -3));

      const res = await app.inject({ method: "GET", url: "/api/calendar/missed-count", headers: authHeaders(user.token) });
      expect(res.json().count).toBe(1);
    });

    it("reschedules overdue tasks to today and the count drops back to 0 (regression: it must not stay stuck)", async () => {
      const user = await registerTestUser(app);
      const headers = authHeaders(user.token);
      const goal = (
        await app.inject({ method: "POST", url: "/api/goals", headers, payload: { domain: "business", title: "Goal" } })
      ).json();
      const overdue = await seedOverdueTask(user.workspaceId, goal.id, addDays(todayISO(), -3));

      const reschedule = await app.inject({ method: "POST", url: "/api/calendar/reschedule-missed", headers, payload: {} });
      expect(reschedule.statusCode).toBe(200);
      expect(reschedule.json().rescheduledCount).toBe(1);

      const originalRow = await prisma.taskInstance.findUniqueOrThrow({ where: { id: overdue.id } });
      expect(originalRow.status).toBe("missed");

      const freshRow = await prisma.taskInstance.findFirst({
        where: { stepId: overdue.stepId, scheduledDate: todayISO() },
      });
      expect(freshRow).not.toBeNull();
      expect(freshRow!.status).toBe("scheduled");
      expect(freshRow!.rescheduledFrom).toBe(overdue.scheduledDate);

      // This is the exact bug caught during manual verification: the
      // now-"missed" original row must not keep matching the missed-count
      // query forever after it's already been rescheduled.
      const countAfter = await app.inject({ method: "GET", url: "/api/calendar/missed-count", headers });
      expect(countAfter.json().count).toBe(0);
    });

    it("does not double-book a step that already has an instance on the target date", async () => {
      const user = await registerTestUser(app);
      const headers = authHeaders(user.token);
      const goal = (
        await app.inject({ method: "POST", url: "/api/goals", headers, payload: { domain: "business", title: "Goal" } })
      ).json();
      const overdue = await seedOverdueTask(user.workspaceId, goal.id, addDays(todayISO(), -1));

      // Same step already has a (separate) instance scheduled for today.
      await prisma.taskInstance.create({
        data: {
          workspaceId: user.workspaceId,
          stepId: overdue.stepId,
          goalId: goal.id,
          domain: "business",
          title: "Already today",
          scheduledDate: todayISO(),
          durationMinutes: 30,
          status: "scheduled",
        },
      });

      const reschedule = await app.inject({ method: "POST", url: "/api/calendar/reschedule-missed", headers, payload: {} });
      expect(reschedule.json().rescheduledCount).toBe(0);

      const todayCount = await prisma.taskInstance.count({
        where: { stepId: overdue.stepId, scheduledDate: todayISO() },
      });
      expect(todayCount).toBe(1);
    });
  });

  describe("generate", () => {
    it("expands a daily-recurring step into instances across the range", async () => {
      const user = await registerTestUser(app);
      const headers = authHeaders(user.token);
      const goal = (
        await app.inject({ method: "POST", url: "/api/goals", headers, payload: { domain: "business", title: "Goal" } })
      ).json();
      await app.inject({
        method: "POST",
        url: "/api/steps",
        headers,
        payload: {
          goalId: goal.id,
          domain: "business",
          title: "Daily task",
          estimatedMinutes: 30,
          recurrence: { freq: "daily" },
        },
      });

      const rangeStart = todayISO();
      const rangeEnd = addDays(rangeStart, 6);
      const res = await app.inject({
        method: "POST",
        url: "/api/calendar/generate",
        headers,
        payload: { rangeStart, rangeEnd },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().placed.length).toBeGreaterThan(0);

      const list = await app.inject({ method: "GET", url: `/api/calendar?start=${rangeStart}&end=${rangeEnd}`, headers });
      expect(list.json().length).toBeGreaterThan(0);
    });
  });
});
