import type { LifeDomain, RecurrenceRule } from "../domain/types.js";

export interface SuggestedStep {
  title: string;
  estimatedMinutes: number;
  priority: number;
  recurrence: RecurrenceRule;
}

interface KeywordTemplate {
  keywords: RegExp;
  domain: LifeDomain;
  steps: SuggestedStep[];
}

const KEYWORD_TEMPLATES: KeywordTemplate[] = [
  {
    keywords: /youtube|channel|video/i,
    domain: "business",
    steps: [
      { title: "Brainstorm 5 video ideas", estimatedMinutes: 30, priority: 2, recurrence: { freq: "weekly" } },
      { title: "Script/outline next video", estimatedMinutes: 60, priority: 2, recurrence: { freq: "weekly" } },
      { title: "Film video", estimatedMinutes: 90, priority: 1, recurrence: { freq: "weekly" } },
      { title: "Edit and publish video", estimatedMinutes: 120, priority: 1, recurrence: { freq: "weekly" } },
      { title: "Review channel analytics", estimatedMinutes: 20, priority: 3, recurrence: { freq: "weekly" } },
    ],
  },
  {
    keywords: /exam|test|study|course|certification/i,
    domain: "study",
    steps: [
      { title: "Gather and organize study materials", estimatedMinutes: 45, priority: 1, recurrence: { freq: "once" } },
      { title: "Focused study session", estimatedMinutes: 45, priority: 2, recurrence: { freq: "daily" } },
      { title: "Practice problems / past papers", estimatedMinutes: 45, priority: 2, recurrence: { freq: "weekly" } },
      { title: "Review weak topics", estimatedMinutes: 30, priority: 2, recurrence: { freq: "weekly" } },
    ],
  },
  {
    keywords: /social|friends|network|relationship/i,
    domain: "social",
    steps: [
      { title: "Reach out to a friend or contact", estimatedMinutes: 15, priority: 3, recurrence: { freq: "daily" } },
      { title: "Plan a hangout or call", estimatedMinutes: 20, priority: 3, recurrence: { freq: "weekly" } },
      { title: "Attend a social event or meetup", estimatedMinutes: 120, priority: 2, recurrence: { freq: "weekly" } },
    ],
  },
];

const DOMAIN_FALLBACK: Record<LifeDomain, SuggestedStep[]> = {
  study: [
    { title: "Define what 'done' looks like for this goal", estimatedMinutes: 20, priority: 1, recurrence: { freq: "once" } },
    { title: "Dedicated study block", estimatedMinutes: 45, priority: 2, recurrence: { freq: "daily" } },
    { title: "Weekly progress review", estimatedMinutes: 20, priority: 3, recurrence: { freq: "weekly" } },
  ],
  business: [
    { title: "Define what 'done' looks like for this goal", estimatedMinutes: 20, priority: 1, recurrence: { freq: "once" } },
    { title: "Weekly planning session", estimatedMinutes: 30, priority: 2, recurrence: { freq: "weekly" } },
    { title: "Focused execution block", estimatedMinutes: 60, priority: 2, recurrence: { freq: "daily" } },
    { title: "Review progress against goal", estimatedMinutes: 20, priority: 3, recurrence: { freq: "weekly" } },
  ],
  social: [
    { title: "Reach out to someone new", estimatedMinutes: 15, priority: 2, recurrence: { freq: "daily" } },
    { title: "Plan a social activity", estimatedMinutes: 20, priority: 3, recurrence: { freq: "weekly" } },
  ],
  relax: [
    { title: "Unplugged downtime block", estimatedMinutes: 45, priority: 3, recurrence: { freq: "daily" } },
    { title: "Do something purely for fun", estimatedMinutes: 60, priority: 3, recurrence: { freq: "weekly" } },
  ],
};

/**
 * Rule-based goal breakdown. Deliberately isolated so it can be swapped for
 * an actual LLM-backed suggestion service later without touching callers —
 * they only ever see `SuggestedStep[]`.
 */
export function suggestStepsForGoal(goal: { title: string; domain: LifeDomain }): SuggestedStep[] {
  const match = KEYWORD_TEMPLATES.find((t) => t.keywords.test(goal.title));
  if (match) return match.steps;
  return DOMAIN_FALLBACK[goal.domain];
}
