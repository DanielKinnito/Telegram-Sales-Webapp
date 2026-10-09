import cron from "node-cron";
import { CronService } from "./cronService.js";

export interface SchedulerOptions {
  cronService: CronService;
  briefingSchedule?: string | undefined;
  inactivitySchedule?: string | undefined;
  timezone?: string | undefined;
}

export function startScheduler(options: SchedulerOptions) {
  const { cronService } = options;
  const briefingSchedule = options.briefingSchedule || "0 9 * * *"; // Daily 9:00 AM
  const inactivitySchedule = options.inactivitySchedule || "0 10 * * *"; // Daily 10:00 AM
  const timezone = options.timezone || "Africa/Addis_Ababa";

  // 1. Daily 9:00 AM follow-up briefing
  const briefingTask = cron.schedule(
    briefingSchedule,
    async () => {
      console.log("⏰ Running Daily 9:00 AM Follow-Up Briefing Worker...");
      try {
        const result = await cronService.runDailyFollowUpBriefing();
        console.log(
          `✅ Daily briefing complete. ${result.totalBriefingsSent} reps notified.`
        );
      } catch (err) {
        console.error("❌ Error in Daily Follow-Up Briefing:", err);
      }
    },
    { timezone }
  );

  // 2. Daily 7-day inactivity deal sweeper
  const sweeperTask = cron.schedule(
    inactivitySchedule,
    async () => {
      console.log("⏰ Running 7-Day Inactivity Deal Sweeper Worker...");
      try {
        const result = await cronService.runInactivitySweeper();
        console.log(
          `✅ Inactivity sweep complete. ${result.stalledDealsCount} stalled deals identified, ${result.alertsSent} alerts sent.`
        );
      } catch (err) {
        console.error("❌ Error in Inactivity Deal Sweeper:", err);
      }
    },
    { timezone }
  );

  // 3. Periodic Call Reminder Worker (Runs every minute for exact arrival)
  const reminderTask = cron.schedule(
    "* * * * *",
    async () => {
      try {
        const result = await cronService.checkAndDispatchDueReminders();
        if (result.remindersSent > 0) {
          console.log(`📞 Call reminder check dispatched ${result.remindersSent} alerts.`);
        }
      } catch (err) {
        console.error("❌ Error in Call Reminder Worker:", err);
      }
    },
    { timezone }
  );

  return {
    briefingTask,
    sweeperTask,
    reminderTask,
    stop: () => {
      briefingTask.stop();
      sweeperTask.stop();
      reminderTask.stop();
    },
  };
}
