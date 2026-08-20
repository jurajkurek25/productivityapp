import { describe, expect, it } from "vitest";
import { buildStudyPlan } from "./planner.js";
import type { StudyMaterialItem } from "../domain/types.js";

const materials: StudyMaterialItem[] = [
  { id: "m1", title: "Chapter 1: Basics", estimatedMinutes: 60, difficulty: 2 },
  { id: "m2", title: "Chapter 2: Advanced", estimatedMinutes: 120, difficulty: 5 },
  { id: "m3", title: "Chapter 3: Review", estimatedMinutes: 30, difficulty: 1 },
];

describe("buildStudyPlan", () => {
  it("spreads all material minutes across the days before the exam without dropping any", () => {
    const plan = buildStudyPlan({
      goalId: "goal1",
      materials,
      examDate: "2026-08-10",
      startDate: "2026-08-01",
      dailyCapacityMinutes: () => 60,
    });

    const totalPlanned = plan.days.reduce(
      (sum, day) => sum + day.items.filter((i) => !i.isReview).reduce((s, i) => s + i.minutes, 0),
      0
    );
    const totalNeeded = materials.reduce((s, m) => s + m.estimatedMinutes, 0);
    expect(totalPlanned).toBe(totalNeeded);
    expect(plan.days.every((d) => d.date < "2026-08-10")).toBe(true);
  });

  it("schedules the hardest topic before the easiest one starts", () => {
    const plan = buildStudyPlan({
      goalId: "goal1",
      materials,
      examDate: "2026-08-10",
      startDate: "2026-08-01",
      dailyCapacityMinutes: () => 60,
    });
    const firstDayWithM2 = plan.days.find((d) => d.items.some((i) => i.materialId === "m2"));
    const firstDayWithM3 = plan.days.find((d) => d.items.some((i) => i.materialId === "m3"));
    expect(firstDayWithM2).toBeDefined();
    expect(firstDayWithM3).toBeDefined();
    expect(firstDayWithM2!.date <= firstDayWithM3!.date).toBe(true);
  });

  it("adds a review pass for the hardest topics on the final days before the exam", () => {
    const plan = buildStudyPlan({
      goalId: "goal1",
      materials,
      examDate: "2026-08-10",
      startDate: "2026-08-01",
      dailyCapacityMinutes: () => 90,
      reviewDays: 2,
    });
    const lastDay = plan.days[plan.days.length - 1];
    expect(lastDay.items.some((i) => i.isReview)).toBe(true);
  });

  it("crams everything onto the start date when the exam is immediate", () => {
    const plan = buildStudyPlan({
      goalId: "goal1",
      materials,
      examDate: "2026-08-01",
      startDate: "2026-08-01",
    });
    expect(plan.days).toHaveLength(1);
    expect(plan.days[0].date).toBe("2026-08-01");
    const total = plan.days[0].items.reduce((s, i) => s + i.minutes, 0);
    expect(total).toBe(materials.reduce((s, m) => s + m.estimatedMinutes, 0));
  });
});
