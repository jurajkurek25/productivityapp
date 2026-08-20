import "dotenv/config";
import cron from "node-cron";
import { buildApp } from "./app.js";
import { pushEnabled, sendDailyReminders } from "./lib/push.js";

const port = Number(process.env.PORT ?? 4000);

buildApp()
  .then((app) => {
    if (pushEnabled) {
      const schedule = process.env.REMINDER_CRON ?? "0 8 * * *";
      cron.schedule(schedule, () => {
        sendDailyReminders().catch((err) => app.log.error(err, "Failed to send daily reminders"));
      });
      app.log.info(`Daily reminder push scheduled: ${schedule}`);
    }
    return app.listen({ port, host: "0.0.0.0" });
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
