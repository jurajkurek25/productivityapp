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
    keywords: /youtube|channel|video|kanál|kanal/i,
    domain: "business",
    steps: [
      { title: "Vymyslieť 5 nápadov na video", estimatedMinutes: 30, priority: 2, recurrence: { freq: "weekly" } },
      { title: "Napísať scenár/osnovu ďalšieho videa", estimatedMinutes: 60, priority: 2, recurrence: { freq: "weekly" } },
      { title: "Natočiť video", estimatedMinutes: 90, priority: 1, recurrence: { freq: "weekly" } },
      { title: "Zostrihať a publikovať video", estimatedMinutes: 120, priority: 1, recurrence: { freq: "weekly" } },
      { title: "Skontrolovať štatistiky kanála", estimatedMinutes: 20, priority: 3, recurrence: { freq: "weekly" } },
    ],
  },
  {
    keywords: /exam|test|study|course|certification|skúšk|štúdi|studi|kurz|certifik/i,
    domain: "study",
    steps: [
      { title: "Zhromaždiť a usporiadať študijné materiály", estimatedMinutes: 45, priority: 1, recurrence: { freq: "once" } },
      { title: "Sústredená študijná session", estimatedMinutes: 45, priority: 2, recurrence: { freq: "daily" } },
      { title: "Precvičiť príklady / staré testy", estimatedMinutes: 45, priority: 2, recurrence: { freq: "weekly" } },
      { title: "Zopakovať slabšie témy", estimatedMinutes: 30, priority: 2, recurrence: { freq: "weekly" } },
    ],
  },
  {
    keywords: /social|friends|network|relationship|sociáln|social|priatel|kamarát|vzťah/i,
    domain: "social",
    steps: [
      { title: "Ozvať sa priateľovi alebo kontaktu", estimatedMinutes: 15, priority: 3, recurrence: { freq: "daily" } },
      { title: "Naplánovať stretnutie alebo hovor", estimatedMinutes: 20, priority: 3, recurrence: { freq: "weekly" } },
      { title: "Zúčastniť sa spoločenskej akcie", estimatedMinutes: 120, priority: 2, recurrence: { freq: "weekly" } },
    ],
  },
];

const DOMAIN_FALLBACK: Record<LifeDomain, SuggestedStep[]> = {
  study: [
    { title: "Definovať, ako vyzerá „hotovo“ pre tento cieľ", estimatedMinutes: 20, priority: 1, recurrence: { freq: "once" } },
    { title: "Vyhradený blok na štúdium", estimatedMinutes: 45, priority: 2, recurrence: { freq: "daily" } },
    { title: "Týždenné zhodnotenie pokroku", estimatedMinutes: 20, priority: 3, recurrence: { freq: "weekly" } },
  ],
  business: [
    { title: "Definovať, ako vyzerá „hotovo“ pre tento cieľ", estimatedMinutes: 20, priority: 1, recurrence: { freq: "once" } },
    { title: "Týždenné plánovanie", estimatedMinutes: 30, priority: 2, recurrence: { freq: "weekly" } },
    { title: "Sústredený blok na prácu", estimatedMinutes: 60, priority: 2, recurrence: { freq: "daily" } },
    { title: "Zhodnotiť pokrok voči cieľu", estimatedMinutes: 20, priority: 3, recurrence: { freq: "weekly" } },
  ],
  social: [
    { title: "Ozvať sa niekomu novému", estimatedMinutes: 15, priority: 2, recurrence: { freq: "daily" } },
    { title: "Naplánovať spoločenskú aktivitu", estimatedMinutes: 20, priority: 3, recurrence: { freq: "weekly" } },
  ],
  relax: [
    { title: "Blok voľna bez zariadení", estimatedMinutes: 45, priority: 3, recurrence: { freq: "daily" } },
    { title: "Urobiť niečo čisto pre radosť", estimatedMinutes: 60, priority: 3, recurrence: { freq: "weekly" } },
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
