import { describe, expect, it } from "vitest";
import { computeDomainBalance } from "./tracker.js";
import type { TaskInstance } from "../domain/types.js";

function inst(overrides: Partial<TaskInstance>): TaskInstance {
  return {
    id: overrides.id ?? Math.random().toString(),
    workspaceId: "ws1",
    stepId: "s1",
    goalId: "g1",
    domain: "study",
    title: "task",
    scheduledDate: "2026-08-05",
    durationMinutes: 30,
    status: "scheduled",
    createdAt: "2026-08-01T00:00:00Z",
    updatedAt: "2026-08-01T00:00:00Z",
    ...overrides,
  };
}

describe("computeDomainBalance", () => {
  it("flags a domain with zero activity as neglected", () => {
    const report = computeDomainBalance({
      instances: [
        inst({ domain: "study", durationMinutes: 300, status: "completed" }),
        inst({ domain: "business", durationMinutes: 300, status: "completed" }),
      ],
      windowStart: "2026-08-01",
      windowEnd: "2026-08-07",
    });
    expect(report.neglectedDomains).toContain("social");
    expect(report.neglectedDomains).toContain("relax");
    expect(report.neglectedDomains).not.toContain("study");
  });

  it("computes completion rate per domain", () => {
    const report = computeDomainBalance({
      instances: [
        inst({ domain: "study", durationMinutes: 60, status: "completed" }),
        inst({ domain: "study", durationMinutes: 60, status: "missed" }),
      ],
      windowStart: "2026-08-01",
      windowEnd: "2026-08-07",
    });
    const study = report.domains.find((d) => d.domain === "study")!;
    expect(study.completionRate).toBe(0.5);
    expect(study.scheduledMinutes).toBe(120);
  });

  it("ignores instances outside the window", () => {
    const report = computeDomainBalance({
      instances: [inst({ domain: "study", scheduledDate: "2026-09-01", durationMinutes: 999 })],
      windowStart: "2026-08-01",
      windowEnd: "2026-08-07",
    });
    const study = report.domains.find((d) => d.domain === "study")!;
    expect(study.scheduledMinutes).toBe(0);
  });

  it("flags a domain below the neglect share threshold even with some activity", () => {
    const report = computeDomainBalance({
      instances: [
        inst({ domain: "study", durationMinutes: 900, status: "completed" }),
        inst({ domain: "social", durationMinutes: 10, status: "completed" }),
      ],
      windowStart: "2026-08-01",
      windowEnd: "2026-08-07",
      neglectShareThreshold: 0.1,
    });
    const social = report.domains.find((d) => d.domain === "social")!;
    expect(social.neglected).toBe(true);
  });
});
