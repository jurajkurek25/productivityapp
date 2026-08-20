import { describe, expect, it } from "vitest";
import { HeuristicEnergyEngine } from "./engine.js";
import type { TaskCompletionRecord } from "../domain/types.js";

const engine = new HeuristicEnergyEngine();

function record(date: string, scheduled: number, completed: number): TaskCompletionRecord {
  return {
    date,
    scheduledCount: scheduled,
    completedCount: completed,
    missedCount: scheduled - completed,
    scheduledMinutes: scheduled * 30,
    completedMinutes: completed * 30,
  };
}

describe("HeuristicEnergyEngine", () => {
  it("scores a perfect completion streak highly with a load multiplier above 1", () => {
    const history: TaskCompletionRecord[] = [
      record("2026-08-10", 4, 4),
      record("2026-08-11", 4, 4),
      record("2026-08-12", 4, 4),
      record("2026-08-13", 4, 4),
      record("2026-08-14", 4, 4),
      record("2026-08-15", 4, 4),
      record("2026-08-16", 4, 4),
    ];
    const state = engine.infer(history, "2026-08-16");
    expect(state.score).toBeGreaterThan(80);
    expect(state.loadMultiplier).toBeGreaterThan(1);
    expect(state.signals.missedStreak).toBe(0);
  });

  it("scores a fully missed streak low with a reduced load multiplier", () => {
    const history: TaskCompletionRecord[] = [
      record("2026-08-10", 4, 0),
      record("2026-08-11", 4, 0),
      record("2026-08-12", 4, 0),
      record("2026-08-13", 4, 0),
      record("2026-08-14", 4, 0),
    ];
    const state = engine.infer(history, "2026-08-14");
    expect(state.score).toBeLessThan(30);
    expect(state.loadMultiplier).toBeLessThan(0.7);
    expect(state.signals.missedStreak).toBeGreaterThanOrEqual(3);
  });

  it("treats no history as neutral", () => {
    const state = engine.infer([], "2026-08-14");
    expect(state.score).toBeGreaterThan(45);
    expect(state.score).toBeLessThan(75);
  });

  it("detects a rising trend when recent days outperform earlier ones", () => {
    const history: TaskCompletionRecord[] = [
      record("2026-08-10", 4, 1),
      record("2026-08-11", 4, 1),
      record("2026-08-12", 4, 1),
      record("2026-08-13", 4, 1),
      record("2026-08-14", 4, 4),
      record("2026-08-15", 4, 4),
      record("2026-08-16", 4, 4),
    ];
    const state = engine.infer(history, "2026-08-16");
    expect(state.trend).toBe("rising");
  });

  it("ignores idle days (no scheduled tasks) when computing streaks", () => {
    const history: TaskCompletionRecord[] = [
      record("2026-08-14", 4, 4),
      record("2026-08-15", 0, 0),
      record("2026-08-16", 4, 4),
    ];
    const state = engine.infer(history, "2026-08-16");
    expect(state.signals.missedStreak).toBe(0);
    expect(state.signals.completedStreak).toBeGreaterThanOrEqual(2);
  });
});
