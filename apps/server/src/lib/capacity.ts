import { DEFAULT_WEEKLY_CAPACITY, type WeeklyCapacityTemplate } from "@productivityapp/core";

export function parseWeeklyCapacity(json: string | null | undefined): WeeklyCapacityTemplate {
  if (!json) return DEFAULT_WEEKLY_CAPACITY;
  try {
    const parsed = JSON.parse(json);
    if (parsed?.days?.length === 7) return parsed as WeeklyCapacityTemplate;
  } catch {
    // fall through to default
  }
  return DEFAULT_WEEKLY_CAPACITY;
}
