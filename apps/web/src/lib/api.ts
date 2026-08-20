import type {
  EnergyState,
  Goal,
  GoalStatus,
  LifeDomain,
  PriorityReport,
  RecurrenceRule,
  Step,
  StudyPlan,
  SuggestedStep,
  TaskInstance,
  WeeklyCapacityTemplate,
} from "@productivityapp/core";

const API_BASE = import.meta.env.VITE_API_URL ?? "/api";
const TOKEN_KEY = "balance.token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}
export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.error ? JSON.stringify(body.error) : res.statusText);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export interface AuthResponse {
  token: string;
  user: { id: string; email: string; name?: string | null };
  workspace: { id: string; name: string };
}

export type GoalProgressStatus = "on_track" | "behind" | "no_deadline" | "no_planned_work";

export interface GoalProgress {
  goalId: string;
  targetDate: string | null;
  daysRemaining: number | null;
  totalPlannedMinutes: number;
  completedPlannedMinutes: number;
  remainingMinutes: number;
  totalCompletedMinutes: number;
  recentPaceMinutesPerDay: number;
  status: GoalProgressStatus;
}

export interface BehindPaceGoal {
  goalId: string;
  title: string;
  targetDate: string;
  daysRemaining: number;
  remainingMinutes: number;
}

export interface GoalTimeInvestment {
  goalId: string;
  title: string;
  domain: LifeDomain;
  status: GoalStatus;
  scheduledMinutes: number;
  completedMinutes: number;
  completionRate: number;
}

export interface NeglectedGoal {
  goalId: string;
  title: string;
  domain: LifeDomain;
  daysSinceLastActivity: number | null;
}

export interface GoalInvestmentTrendPoint {
  weekStart: string;
  completedMinutes: number;
}

export const api = {
  register: (email: string, password: string, name?: string) =>
    request<AuthResponse>("/auth/register", { method: "POST", body: JSON.stringify({ email, password, name }) }),
  login: (email: string, password: string) =>
    request<AuthResponse>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  me: () => request<{ user: AuthResponse["user"]; workspace: AuthResponse["workspace"] }>("/me"),
  changePassword: (currentPassword: string, newPassword: string) =>
    request<void>("/auth/change-password", { method: "POST", body: JSON.stringify({ currentPassword, newPassword }) }),

  listGoals: () => request<Goal[]>("/goals"),
  createGoal: (data: { domain: LifeDomain; title: string; description?: string; targetDate?: string }) =>
    request<Goal>("/goals", { method: "POST", body: JSON.stringify(data) }),
  getGoal: (id: string) => request<Goal & { steps: Step[] }>(`/goals/${id}`),
  updateGoal: (id: string, data: Partial<Goal>) =>
    request<Goal>(`/goals/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteGoal: (id: string) => request<void>(`/goals/${id}`, { method: "DELETE" }),
  suggestSteps: (goalId: string) => request<SuggestedStep[]>(`/goals/${goalId}/suggest-steps`),
  getGoalProgress: (goalId: string) => request<GoalProgress>(`/goals/${goalId}/progress`),
  getGoalsBehindPace: () => request<BehindPaceGoal[]>("/goals/progress-summary"),
  getGoalTimeInvestment: (windowDays = 7) =>
    request<GoalTimeInvestment[]>(`/goals/time-investment?windowDays=${windowDays}`),
  getNeglectedGoals: (windowDays = 14) => request<NeglectedGoal[]>(`/goals/neglected?windowDays=${windowDays}`),
  getGoalInvestmentTrend: (goalId: string, weeks = 8) =>
    request<GoalInvestmentTrendPoint[]>(`/goals/${goalId}/investment-trend?weeks=${weeks}`),

  listSteps: (goalId?: string) => request<Step[]>(`/steps${goalId ? `?goalId=${goalId}` : ""}`),
  createStep: (data: {
    goalId: string;
    domain: LifeDomain;
    title: string;
    estimatedMinutes: number;
    priority?: number;
    recurrence: RecurrenceRule;
    earliestDate?: string;
    aiSuggested?: boolean;
  }) => request<Step>("/steps", { method: "POST", body: JSON.stringify(data) }),
  updateStep: (
    id: string,
    data: Partial<{
      domain: LifeDomain;
      title: string;
      notes: string;
      estimatedMinutes: number;
      priority: number;
      recurrence: RecurrenceRule;
      earliestDate: string;
      status: Step["status"];
    }>
  ) => request<Step>(`/steps/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteStep: (id: string) => request<void>(`/steps/${id}`, { method: "DELETE" }),

  listCalendar: (start: string, end: string) => request<TaskInstance[]>(`/calendar?start=${start}&end=${end}`),
  generateCalendar: (rangeStart: string, rangeEnd: string) =>
    request<{ energyState: EnergyState; placed: TaskInstance[]; unplaced: unknown[] }>("/calendar/generate", {
      method: "POST",
      body: JSON.stringify({ rangeStart, rangeEnd }),
    }),
  updateInstance: (
    id: string,
    data: Partial<{
      status: TaskInstance["status"];
      title: string;
      domain: LifeDomain;
      scheduledDate: string;
      durationMinutes: number;
    }>
  ) => request<TaskInstance>(`/calendar/instances/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  quickAddTask: (data: { title: string; domain: LifeDomain; scheduledDate?: string; durationMinutes?: number }) =>
    request<TaskInstance>("/calendar/quick", { method: "POST", body: JSON.stringify(data) }),
  getMissedCount: () => request<{ count: number }>("/calendar/missed-count"),
  rescheduleMissed: (targetDate?: string) =>
    request<{ rescheduledCount: number; targetDate: string }>("/calendar/reschedule-missed", {
      method: "POST",
      body: JSON.stringify({ targetDate }),
    }),

  getEnergy: (date?: string) => request<EnergyState>(`/energy${date ? `?date=${date}` : ""}`),
  getEnergyTrend: (days = 30) =>
    request<{ date: string; score: number; completionRate: number | null }[]>(`/energy/trend?days=${days}`),
  getPriority: (windowDays = 7) => request<PriorityReport>(`/priority?windowDays=${windowDays}`),

  createStudyPlan: (data: {
    goalTitle: string;
    examDate: string;
    startDate: string;
    materials: { title: string; estimatedMinutes: number; difficulty: number }[];
    dailyCapacityMinutes?: number;
  }) =>
    request<{ goal: Goal; plan: StudyPlan; scheduled: TaskInstance[]; unplaced: unknown[] }>("/study/plans", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  getPushPublicKey: () => request<{ publicKey: string }>("/push/public-key"),
  getPushStatus: () => request<{ subscribed: boolean }>("/push/status"),
  subscribePush: (subscription: PushSubscriptionJSON) =>
    request<void>("/push/subscribe", { method: "POST", body: JSON.stringify(subscription) }),
  unsubscribePush: (endpoint: string) =>
    request<void>("/push/unsubscribe", { method: "POST", body: JSON.stringify({ endpoint }) }),

  getCapacity: () => request<WeeklyCapacityTemplate>("/workspace/capacity"),
  updateCapacity: (data: WeeklyCapacityTemplate) =>
    request<WeeklyCapacityTemplate>("/workspace/capacity", { method: "PUT", body: JSON.stringify(data) }),

  exportData: async (): Promise<Blob> => {
    const token = getToken();
    const res = await fetch(`${API_BASE}/workspace/export`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new ApiError(res.status, res.statusText);
    return res.blob();
  },
};

export { ApiError };
