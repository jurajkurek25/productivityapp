import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { buildStudyPlan, defaultEnergyEngine, scheduleRange } from "@productivityapp/core";
import { prisma } from "../lib/prisma.js";
import { toDomainStep, toDomainTaskInstance } from "../lib/mappers.js";
import { buildCompletionHistory } from "../lib/energyHistory.js";
import { parseWeeklyCapacity } from "../lib/capacity.js";

const materialSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1).max(200),
  estimatedMinutes: z.number().min(1).max(24 * 60),
  difficulty: z.number().min(1).max(5).default(3),
});

const createPlanSchema = z.object({
  goalTitle: z.string().min(1).max(200),
  examDate: z.string(),
  startDate: z.string(),
  materials: z.array(materialSchema).min(1),
  dailyCapacityMinutes: z.number().min(1).max(600).optional(),
});

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function studyRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.authenticate);

  /**
   * Creates a study goal, splits the given materials into a day-by-day plan
   * up to the exam date, persists each day's chunk as a one-off Step, and
   * immediately schedules them through the normal capacity/energy-aware
   * scheduler — study never gets a separate calendar of its own.
   */
  app.post("/study/plans", async (request, reply) => {
    const parsed = createPlanSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const { workspaceId } = request.user;
    const { goalTitle, examDate, startDate, materials, dailyCapacityMinutes } = parsed.data;

    const materialsWithIds = materials.map((m, i) => ({ ...m, id: m.id ?? `mat-${i}` }));

    const goal = await prisma.goal.create({
      data: { workspaceId, domain: "study", title: goalTitle, targetDate: examDate, status: "active" },
    });

    const plan = buildStudyPlan({
      goalId: goal.id,
      materials: materialsWithIds,
      examDate,
      startDate,
      dailyCapacityMinutes: dailyCapacityMinutes ? () => dailyCapacityMinutes : undefined,
    });

    const stepCreates = plan.days.flatMap((day) =>
      day.items
        .filter((item) => item.minutes > 0)
        .map((item) => ({
          workspaceId,
          goalId: goal.id,
          domain: "study" as const,
          title: item.isReview ? `Review: ${item.title}` : item.title,
          estimatedMinutes: item.minutes,
          priority: item.isReview ? 3 : 2,
          recurrenceFreq: "once" as const,
          recurrenceDaysOfWeek: "",
          recurrenceInterval: 1,
          earliestDate: day.date,
          aiSuggested: false,
          status: "active" as const,
        }))
    );

    if (stepCreates.length > 0) {
      await prisma.step.createMany({ data: stepCreates });
    }

    const [workspace, stepRows, existingRows] = await Promise.all([
      prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId } }),
      prisma.step.findMany({ where: { workspaceId, goalId: goal.id } }),
      prisma.taskInstance.findMany({ where: { workspaceId } }),
    ]);

    const today = todayISO();
    const history = await buildCompletionHistory(workspaceId, today);
    const energyState = defaultEnergyEngine.infer(history, today);

    const schedulerResult = scheduleRange({
      steps: stepRows.map(toDomainStep),
      existingInstances: existingRows.map(toDomainTaskInstance),
      weeklyCapacity: parseWeeklyCapacity(workspace.weeklyCapacityJson),
      energyByDate: (date) => ({ ...energyState, date }),
      rangeStart: startDate,
      rangeEnd: examDate,
      makeId: () => crypto.randomUUID(),
      now: () => new Date().toISOString(),
    });

    if (schedulerResult.placed.length > 0) {
      await prisma.taskInstance.createMany({
        data: schedulerResult.placed.map((p) => ({
          id: p.id,
          workspaceId: p.workspaceId,
          stepId: p.stepId,
          goalId: p.goalId,
          domain: p.domain,
          title: p.title,
          scheduledDate: p.scheduledDate,
          durationMinutes: p.durationMinutes,
          status: "scheduled",
          rescheduledFrom: p.rescheduledFrom ?? null,
        })),
      });
    }

    return reply.code(201).send({
      goal,
      plan,
      scheduled: schedulerResult.placed,
      unplaced: schedulerResult.unplaced,
    });
  });
}
