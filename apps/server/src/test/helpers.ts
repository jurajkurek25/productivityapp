import type { FastifyInstance } from "fastify";
import { buildApp } from "../app.js";

export async function createTestApp(): Promise<FastifyInstance> {
  const app = await buildApp();
  await app.ready();
  return app;
}

export interface TestUser {
  token: string;
  userId: string;
  workspaceId: string;
  email: string;
}

export async function registerTestUser(
  app: FastifyInstance,
  overrides?: { email?: string; password?: string; name?: string }
): Promise<TestUser> {
  const email = overrides?.email ?? `test_${Math.random().toString(36).slice(2)}@example.com`;
  const password = overrides?.password ?? "password123";
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { email, password, name: overrides?.name },
  });
  const body = res.json();
  return { token: body.token, userId: body.user.id, workspaceId: body.workspace.id, email };
}

export function authHeaders(token: string) {
  return { authorization: `Bearer ${token}` };
}
