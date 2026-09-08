import { describe, expect, it } from "vitest";
import { scheduleRange } from "./engine.js";
import type { EnergyState, Step, WeeklyCapacityTemplate } from "../domain/types.js";

let idCounter = 0;
const makeId = () => `id-${idCounter++}`;
const now = () => "2026-08-01T00:00:00.000Z";

const flatCapacity: WeeklyCapacityTemplate = {
  days: Array.from({ length: 7 }, () => ({ study: 60, business: 60, social: 60, relax: 60 })),
};

function neutralEnergy(date: string): EnergyState {
  return {
    date,
    score: 70,
    trend: "stable",
    loadMultiplier: 1,
    signals: { completionRate7d: 1, completionRate14d: 1, missedStreak: 0, completedStreak: 0, overdueLoad: 0 },
  };
}

function makeStep(overrides: Partial<Step>): Step {
  return {
    id: overrides.id ?? makeId(),
    workspaceId: "ws1",
    goalId: "goal1",
    domain: "study",
    title: "Study",
    estimatedMinutes: 30,
    priority: 3,
    recurrence: { freq: "daily" },
    status: "active",
    aiSuggested: false,
    createdAt: "2026-08-01T00:00:00Z",
    updatedAt: "2026-08-01T00:00:00Z",
    ...overrides,
  };
}

describe("scheduleRange", () => {
  it("places a single daily step every day in range", () => {
    idCounter = 0;
    const step = makeStep({ earliestDate: "2026-08-01" });
    const result = scheduleRange({
      steps: [step],
      existingInstances: [],
      weeklyCapacity: flatCapacity,
      energyByDate: neutralEnergy,
      rangeStart: "2026-08-01",
      rangeEnd: "2026-08-03",
      makeId,
      now,
    });
    expect(result.unplaced).toEqual([]);
    expect(result.placed.map((p) => p.scheduledDate)).toEqual(["2026-08-01", "2026-08-02", "2026-08-03"]);
  });

  it("slides an overflowing task to the next day with capacity", () => {
    idCounter = 0;
    // Capacity is 60 min/day for study. Two 40-minute study steps target the same day.
    const stepA = makeStep({ id: "a", title: "A", estimatedMinutes: 40, priority: 1, recurrence: { freq: "once" }, earliestDate: "2026-08-01" });
    const stepB = makeStep({ id: "b", title: "B", estimatedMinutes: 40, priority: 2, recurrence: { freq: "once" }, earliestDate: "2026-08-01" });
    const result = scheduleRange({
      steps: [stepA, stepB],
      existingInstances: [],
      weeklyCapacity: flatCapacity,
      energyByDate: neutralEnergy,
      rangeStart: "2026-08-01",
      rangeEnd: "2026-08-05",
      makeId,
      now,
    });
    const byStep = Object.fromEntries(result.placed.map((p) => [p.stepId, p]));
    expect(byStep["a"].scheduledDate).toBe("2026-08-01");
    expect(byStep["b"].scheduledDate).toBe("2026-08-02");
    expect(byStep["b"].rescheduledFrom).toBe("2026-08-01");
  });

  it("reduces effective capacity on a low-energy day", () => {
    idCounter = 0;
    const step = makeStep({
      id: "a",
      estimatedMinutes: 50,
      recurrence: { freq: "once" },
      earliestDate: "2026-08-01",
    });
    // Only the first day is low-energy; capacity recovers afterwards.
    const dippedEnergy = (date: string): EnergyState => ({
      ...neutralEnergy(date),
      loadMultiplier: date === "2026-08-01" ? 0.5 : 1,
    });
    const result = scheduleRange({
      steps: [step],
      existingInstances: [],
      weeklyCapacity: flatCapacity, // 60 min base -> 30 min effective on the low energy day
      energyByDate: dippedEnergy,
      rangeStart: "2026-08-01",
      rangeEnd: "2026-08-03",
      makeId,
      now,
    });
    // 50 minutes doesn't fit in 30 (0.5 * 60), so it should slide to the next day.
    expect(result.placed[0].scheduledDate).toBe("2026-08-02");
  });

  it("marks a candidate unplaced when there is no capacity within the lookahead window", () => {
    idCounter = 0;
    const zeroCapacity: WeeklyCapacityTemplate = {
      days: Array.from({ length: 7 }, () => ({ study: 0, business: 0, social: 0, relax: 0 })),
    };
    const step = makeStep({ id: "a", recurrence: { freq: "once" }, earliestDate: "2026-08-01" });
    const result = scheduleRange({
      steps: [step],
      existingInstances: [],
      weeklyCapacity: zeroCapacity,
      energyByDate: neutralEnergy,
      rangeStart: "2026-08-01",
      rangeEnd: "2026-08-20",
      makeId,
      now,
    });
    expect(result.placed).toEqual([]);
    expect(result.unplaced).toHaveLength(1);
    expect(result.unplaced[0].reason).toBe("no-capacity-in-lookahead-window");
  });

  it("does not double-book a step that already has an existing instance on its target date", () => {
    idCounter = 0;
    const step = makeStep({ id: "a", recurrence: { freq: "once" }, earliestDate: "2026-08-01" });
    const result = scheduleRange({
      steps: [step],
      existingInstances: [
        {
          id: "existing-1",
          workspaceId: "ws1",
          stepId: "a",
          goalId: "goal1",
          domain: "study",
          title: "Study",
          scheduledDate: "2026-08-01",
          durationMinutes: 30,
          status: "completed",
          createdAt: "2026-08-01T00:00:00Z",
          updatedAt: "2026-08-01T00:00:00Z",
        },
      ],
      weeklyCapacity: flatCapacity,
      energyByDate: neutralEnergy,
      rangeStart: "2026-08-01",
      rangeEnd: "2026-08-05",
      makeId,
      now,
    });
    expect(result.placed).toEqual([]);
  });
});
