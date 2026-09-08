import { describe, expect, it } from "vitest";
import { suggestStepsForGoal } from "./suggestSteps.js";

describe("suggestStepsForGoal", () => {
  it("matches a YouTube-flavored title to content production steps", () => {
    const steps = suggestStepsForGoal({ title: "Grow my YouTube channel", domain: "business" });
    expect(steps.some((s) => /video/i.test(s.title))).toBe(true);
  });

  it("falls back to a generic domain template when no keyword matches", () => {
    const steps = suggestStepsForGoal({ title: "Something unrelated entirely", domain: "relax" });
    expect(steps.length).toBeGreaterThan(0);
  });
});
