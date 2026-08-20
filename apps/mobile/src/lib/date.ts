export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function addDaysISO(date: string, n: number): string {
  const t = new Date(date + "T00:00:00Z").getTime() + n * 86_400_000;
  return new Date(t).toISOString().slice(0, 10);
}

export function formatShort(date: string): string {
  return new Date(date + "T00:00:00Z").toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}
