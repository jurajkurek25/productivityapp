import type {
  EnergyState,
  Goal,
  LifeDomain,
  PriorityReport,
  RecurrenceRule,
  Step,
  StudyPlan,
  SuggestedStep,
  TaskInstance,
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

export const api = {
  register: (email: string, password: string, name?: string) =>
    request<AuthResponse>("/auth/register", { method: "POST", body: JSON.stringify({ email, password, name }) }),
  login: (email: string, password: string) =>
    request<AuthResponse>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  me: () => request<{ user: AuthResponse["user"]; workspace: AuthResponse["workspace"] }>("/me"),

  listGoals: () => request<Goal[]>("/goals"),
  createGoal: (data: { domain: LifeDomain; title: string; description?: string; targetDate?: string }) =>
    request<Goal>("/goals", { method: "POST", body: JSON.stringify(data) }),
  getGoal: (id: string) => request<Goal & { steps: Step[] }>(`/goals/${id}`),
  updateGoal: (id: string, data: Partial<Goal>) =>
    request<Goal>(`/goals/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteGoal: (id: string) => request<void>(`/goals/${id}`, { method: "DELETE" }),
  suggestSteps: (goalId: string) => request<SuggestedStep[]>(`/goals/${goalId}/suggest-steps`),

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

  getEnergy: (date?: string) => request<EnergyState>(`/energy${date ? `?date=${date}` : ""}`),
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
};

export { ApiError };
