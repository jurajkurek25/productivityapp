import Fastify from "fastify";
import cors from "@fastify/cors";
import { registerAuth } from "./plugins/auth.js";
import { authRoutes } from "./routes/auth.js";
import { goalRoutes } from "./routes/goals.js";
import { stepRoutes } from "./routes/steps.js";
import { calendarRoutes } from "./routes/calendar.js";
import { energyRoutes } from "./routes/energy.js";
import { priorityRoutes } from "./routes/priority.js";
import { studyRoutes } from "./routes/study.js";

export async function buildApp() {
  const app = Fastify({ logger: true });

  await app.register(cors, {
    origin: process.env.CORS_ORIGIN?.split(",") ?? true,
  });
  await registerAuth(app);

  app.get("/health", async () => ({ status: "ok" }));

  await app.register(authRoutes);
  await app.register(goalRoutes);
  await app.register(stepRoutes);
  await app.register(calendarRoutes);
  await app.register(energyRoutes);
  await app.register(priorityRoutes);
  await app.register(studyRoutes);

  return app;
}
