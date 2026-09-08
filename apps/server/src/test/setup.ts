import { beforeEach } from "vitest";
import { prisma } from "../lib/prisma.js";

beforeEach(async () => {
  await prisma.aiMessage.deleteMany();
  await prisma.pushSubscription.deleteMany();
  await prisma.taskInstance.deleteMany();
  await prisma.step.deleteMany();
  await prisma.goal.deleteMany();
  await prisma.membership.deleteMany();
  await prisma.user.deleteMany();
  await prisma.workspace.deleteMany();
});
