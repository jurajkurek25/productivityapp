import { describe, expect, it } from "vitest";
import { expandOccurrences } from "./recurrence.js";

describe("expandOccurrences", () => {
  it("expands a daily recurrence across the full range", () => {
    const dates = expandOccurrences(
      { earliestDate: "2026-08-01", recurrence: { freq: "daily" }, createdAt: "2026-08-01T00:00:00Z" },
      "2026-08-01",
      "2026-08-05"
    );
    expect(dates).toEqual(["2026-08-01", "2026-08-02", "2026-08-03", "2026-08-04", "2026-08-05"]);
  });

  it("restricts daily recurrence to specific weekdays", () => {
    // 2026-08-01 is a Saturday (6). Restrict to Mon(1)/Wed(3)/Fri(5).
    const dates = expandOccurrences(
      {
        earliestDate: "2026-08-01",
        recurrence: { freq: "daily", daysOfWeek: [1, 3, 5] },
        createdAt: "2026-08-01T00:00:00Z",
      },
      "2026-08-01",
      "2026-08-14"
    );
    for (const d of dates) {
      const dow = new Date(d + "T00:00:00Z").getUTCDay();
      expect([1, 3, 5]).toContain(dow);
    }
    expect(dates.length).toBeGreaterThan(0);
  });

  it("expands a weekly recurrence on the anchor weekday", () => {
    const dates = expandOccurrences(
      { earliestDate: "2026-08-03", recurrence: { freq: "weekly" }, createdAt: "2026-08-03T00:00:00Z" },
      "2026-08-01",
      "2026-08-31"
    );
    // 2026-08-03 is a Monday; expect every Monday in range.
    expect(dates).toEqual(["2026-08-03", "2026-08-10", "2026-08-17", "2026-08-24", "2026-08-31"]);
  });

  it("expands a monthly recurrence on the anchor day-of-month", () => {
    const dates = expandOccurrences(
      { earliestDate: "2026-01-15", recurrence: { freq: "monthly" }, createdAt: "2026-01-15T00:00:00Z" },
      "2026-01-01",
      "2026-06-30"
    );
    expect(dates).toEqual(["2026-01-15", "2026-02-15", "2026-03-15", "2026-04-15", "2026-05-15", "2026-06-15"]);
  });

  it("returns a single date for a once-off step", () => {
    const dates = expandOccurrences(
      { earliestDate: "2026-08-05", recurrence: { freq: "once" }, createdAt: "2026-08-01T00:00:00Z" },
      "2026-08-01",
      "2026-08-31"
    );
    expect(dates).toEqual(["2026-08-05"]);
  });

  it("respects an until date earlier than the range end", () => {
    const dates = expandOccurrences(
      {
        earliestDate: "2026-08-01",
        recurrence: { freq: "daily", until: "2026-08-03" },
        createdAt: "2026-08-01T00:00:00Z",
      },
      "2026-08-01",
      "2026-08-31"
    );
    expect(dates).toEqual(["2026-08-01", "2026-08-02", "2026-08-03"]);
  });
});
