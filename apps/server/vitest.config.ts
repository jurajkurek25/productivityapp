import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./src/test/setup.ts"],
    // Tests share one SQLite test.db file; running files in parallel would
    // race on it. Server-side integration tests are few enough that
    // sequential execution is fast and avoids that entirely.
    fileParallelism: false,
    env: {
      // Prisma resolves relative SQLite "file:" paths relative to
      // schema.prisma's own directory (apps/server/prisma/), not the
      // process cwd — "./test.db" here lands next to dev.db as intended.
      DATABASE_URL: "file:./test.db",
      JWT_SECRET: "test-secret",
      CORS_ORIGIN: "http://localhost:5173",
    },
  },
});
