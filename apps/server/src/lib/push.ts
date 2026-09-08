import webpush from "web-push";
import { defaultEnergyEngine } from "@productivityapp/core";
import { prisma } from "./prisma.js";
import { buildCompletionHistory } from "./energyHistory.js";

const publicKey = process.env.VAPID_PUBLIC_KEY;
const privateKey = process.env.VAPID_PRIVATE_KEY;
const subject = process.env.VAPID_SUBJECT ?? "mailto:admin@example.com";

export const pushEnabled = Boolean(publicKey && privateKey);

if (pushEnabled) {
  webpush.setVapidDetails(subject, publicKey!, privateKey!);
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Sends every user their morning digest: how many tasks are scheduled today
 * and today's inferred energy score, one push per subscribed device. A
 * subscription that the push service reports as gone (410/404) is deleted
 * so we stop retrying it forever.
 */
export async function sendDailyReminders(): Promise<void> {
  if (!pushEnabled) return;

  const subscriptions = await prisma.pushSubscription.findMany({
    include: { user: { include: { memberships: true } } },
  });
  if (subscriptions.length === 0) return;

  const today = todayISO();
  const workspaceCache = new Map<string, { count: number; score: number }>();

  for (const sub of subscriptions) {
    const workspaceId = sub.user.memberships[0]?.workspaceId;
    if (!workspaceId) continue;

    let digest = workspaceCache.get(workspaceId);
    if (!digest) {
      const [instances, history] = await Promise.all([
        prisma.taskInstance.findMany({
          where: { workspaceId, scheduledDate: today, status: "scheduled" },
          select: { id: true },
        }),
        buildCompletionHistory(workspaceId, today),
      ]);
      const energy = defaultEnergyEngine.infer(history, today);
      digest = { count: instances.length, score: energy.score };
      workspaceCache.set(workspaceId, digest);
    }

    const payload = JSON.stringify({
      title: "Dnešný plán",
      body:
        digest.count > 0
          ? `${digest.count} naplánovaných úloh · energia ${digest.score}/100`
          : `Žiadne naplánované úlohy · energia ${digest.score}/100`,
    });

    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload
      );
    } catch (err) {
      const statusCode = (err as { statusCode?: number }).statusCode;
      if (statusCode === 404 || statusCode === 410) {
        await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
      }
    }
  }
}
