import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import Fastify from "fastify";
import cors from "@fastify/cors";
import fastifyStatic from "@fastify/static";
import { registerAuth } from "./plugins/auth.js";
import { authRoutes } from "./routes/auth.js";
import { goalRoutes } from "./routes/goals.js";
import { stepRoutes } from "./routes/steps.js";
import { calendarRoutes } from "./routes/calendar.js";
import { energyRoutes } from "./routes/energy.js";
import { priorityRoutes } from "./routes/priority.js";
import { studyRoutes } from "./routes/study.js";
import { pushRoutes } from "./routes/push.js";
import { workspaceRoutes } from "./routes/workspace.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Sibling web app's build output, e.g. apps/server/dist/../../web/dist ->
// apps/web/dist. Overridable for deployments where the built site lives
// somewhere else (e.g. a separately hosted static frontend).
const DEFAULT_WEB_DIST = path.resolve(__dirname, "../../web/dist");

export async function buildApp() {
  const app = Fastify({ logger: true });

  await app.register(cors, {
    origin: process.env.CORS_ORIGIN?.split(",") ?? true,
  });
  await registerAuth(app);

  // All API routes live under /api so a single process can also serve the
  // built web app at every other path — the common setup for single-Node-app
  // hosting panels that proxy an entire domain to one process.
  await app.register(
    async (api) => {
      api.get("/health", async () => ({ status: "ok" }));
      await api.register(authRoutes);
      await api.register(goalRoutes);
      await api.register(stepRoutes);
      await api.register(calendarRoutes);
      await api.register(energyRoutes);
      await api.register(priorityRoutes);
      await api.register(studyRoutes);
      await api.register(pushRoutes);
      await api.register(workspaceRoutes);
    },
    { prefix: "/api" }
  );

  const webDistPath = process.env.WEB_DIST_PATH
    ? path.resolve(process.env.WEB_DIST_PATH)
    : DEFAULT_WEB_DIST;

  if (fs.existsSync(webDistPath)) {
    await app.register(fastifyStatic, { root: webDistPath });

    // SPA fallback: any non-API, non-file GET (client-side routes like
    // /goals or /calendar) serves index.html so React Router can handle it.
    app.setNotFoundHandler((request, reply) => {
      if (request.raw.url?.startsWith("/api")) {
        return reply.code(404).send({ error: "Not Found" });
      }
      return reply.sendFile("index.html", webDistPath);
    });
  } else {
    app.log.warn(`Web build not found at ${webDistPath} — serving API only.`);
  }

  return app;
}
