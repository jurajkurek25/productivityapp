import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { authHeaders, createTestApp, registerTestUser } from "./helpers.js";

describe("auth", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await createTestApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it("registers a new user and returns a token + workspace", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { email: "alice@example.com", password: "password123", name: "Alice" },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.token).toBeTypeOf("string");
    expect(body.user.email).toBe("alice@example.com");
    expect(body.workspace.id).toBeTypeOf("string");
  });

  it("rejects registering the same email twice", async () => {
    await registerTestUser(app, { email: "dupe@example.com" });
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { email: "dupe@example.com", password: "password123" },
    });
    expect(res.statusCode).toBe(409);
  });

  it("logs in with correct credentials", async () => {
    await registerTestUser(app, { email: "bob@example.com", password: "correct-horse" });
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "bob@example.com", password: "correct-horse" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().token).toBeTypeOf("string");
  });

  it("rejects login with the wrong password", async () => {
    await registerTestUser(app, { email: "carol@example.com", password: "correct-horse" });
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "carol@example.com", password: "wrong-password" },
    });
    expect(res.statusCode).toBe(401);
  });

  it("rejects login for an email that was never registered", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "nobody@example.com", password: "whatever123" },
    });
    expect(res.statusCode).toBe(401);
  });

  describe("change-password", () => {
    it("rejects the wrong current password", async () => {
      const user = await registerTestUser(app, { password: "original123" });
      const res = await app.inject({
        method: "POST",
        url: "/api/auth/change-password",
        headers: authHeaders(user.token),
        payload: { currentPassword: "not-it", newPassword: "brand-new-pass" },
      });
      expect(res.statusCode).toBe(401);
    });

    it("updates the password so the old one stops working and the new one logs in", async () => {
      const user = await registerTestUser(app, { password: "original123" });

      const changeRes = await app.inject({
        method: "POST",
        url: "/api/auth/change-password",
        headers: authHeaders(user.token),
        payload: { currentPassword: "original123", newPassword: "brand-new-pass" },
      });
      expect(changeRes.statusCode).toBe(204);

      const oldLogin = await app.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: { email: user.email, password: "original123" },
      });
      expect(oldLogin.statusCode).toBe(401);

      const newLogin = await app.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: { email: user.email, password: "brand-new-pass" },
      });
      expect(newLogin.statusCode).toBe(200);
    });

    it("requires authentication", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/auth/change-password",
        payload: { currentPassword: "x", newPassword: "brand-new-pass" },
      });
      expect(res.statusCode).toBe(401);
    });
  });

  describe("login rate limiting", () => {
    it("throttles repeated failed attempts against the same account", async () => {
      await registerTestUser(app, { email: "target@example.com", password: "correct-horse" });

      const attempt = () =>
        app.inject({
          method: "POST",
          url: "/api/auth/login",
          payload: { email: "target@example.com", password: "wrong-password" },
        });

      for (let i = 0; i < 10; i++) {
        const res = await attempt();
        expect(res.statusCode).toBe(401);
      }
      const eleventh = await attempt();
      expect(eleventh.statusCode).toBe(429);
    });

    it("does not throttle a different account from the same caller", async () => {
      await registerTestUser(app, { email: "victim-a@example.com", password: "correct-horse" });
      await registerTestUser(app, { email: "victim-b@example.com", password: "correct-horse" });

      const attempt = (email: string) =>
        app.inject({
          method: "POST",
          url: "/api/auth/login",
          payload: { email, password: "wrong-password" },
        });

      for (let i = 0; i < 10; i++) {
        await attempt("victim-a@example.com");
      }
      // victim-a's bucket is now exhausted; victim-b must be unaffected.
      const res = await attempt("victim-b@example.com");
      expect(res.statusCode).toBe(401);
    });
  });
});
