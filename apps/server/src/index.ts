import "dotenv/config";
import cron from "node-cron";
import { buildApp } from "./app.js";
import { pushEnabled, sendDailyReminders } from "./lib/push.js";
import { autoScheduleAllWorkspaces } from "./lib/scheduling.js";

const port = Number(process.env.PORT ?? 4000);

buildApp()
  .then((app) => {
    const scheduleCron = process.env.SCHEDULE_CRON ?? "0 3 * * *";
    cron.schedule(scheduleCron, () => {
      autoScheduleAllWorkspaces().catch((err) => app.log.error(err, "Auto-schedule run failed"));
    });
    app.log.info(`Nightly auto-schedule scheduled: ${scheduleCron}`);

    if (pushEnabled) {
      const reminderCron = process.env.REMINDER_CRON ?? "0 8 * * *";
      cron.schedule(reminderCron, () => {
        sendDailyReminders().catch((err) => app.log.error(err, "Failed to send daily reminders"));
      });
      app.log.info(`Daily reminder push scheduled: ${reminderCron}`);
    }
    return app.listen({ port, host: "0.0.0.0" });
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
