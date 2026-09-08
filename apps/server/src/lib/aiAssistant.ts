import Anthropic from "@anthropic-ai/sdk";
import { LIFE_DOMAINS, type RecurrenceFrequency } from "@productivityapp/core";
import { prisma } from "./prisma.js";
import { recurrenceToRow, toDomainStep } from "./mappers.js";

const MODEL = "claude-opus-5";
const MAX_TOOL_ITERATIONS = 6;

let client: Anthropic | null | undefined;

/** Lazily constructed so a missing key doesn't crash the server at boot — only this feature is unavailable. */
function getClient(): Anthropic | null {
  if (client !== undefined) return client;
  client = process.env.ANTHROPIC_API_KEY ? new Anthropic() : null;
  return client;
}

export function isAiAssistantConfigured(): boolean {
  return getClient() !== null;
}

const SYSTEM_PROMPT = `Si osobný asistent v aplikácii Balance — appke na energiou-adaptívne plánovanie času a sledovanie osobných cieľov. Komunikuješ výhradne po slovensky, teplo a stručne, nikdy nie ako firemný bot.

Tvoja úloha:
1. Najprv sa opýtaj používateľa, ako sa cíti, čo chce dosiahnuť a ako sa chce cítiť, keď to dosiahne — ak to už nenapísal.
2. Kladie doplňujúce otázky (jednu-dve naraz, nie výsluch), kým nemáš dosť na konkrétny návrh: v akej oblasti života je to (Štúdium/Biznis/Sociálne/Relax), aký je reálny časový rámec, koľko času týždenne na to vie reálne venovať.
3. Až keď máš dosť kontextu, navrhni 1-3 konkrétne ciele rozdelené na kroky — a rovno ich vytvor v appke pomocou nástrojov create_goal a create_step. Nikdy len nepíš návrh do textu bez toho, aby si zavolal nástroj — ak sa rozhodneš niečo navrhnúť, rovno to aj vytvor.
4. Pred vytvorením over cez list_goals, či už podobný cieľ neexistuje, aby si nerobil duplicity.
5. Kroky rozdeľuj rozumne: jednorazové úlohy (freq "once") pre konkrétny konečný výsledok, opakujúce sa kroky (freq "daily"/"weekly"/"monthly") pre návyky. estimatedMinutes je čas na jeden výskyt kroku. priority 1-5 (5 = najdôležitejšie), predvolene 3.
6. Po vytvorení stručne zhrň, čo si pridal, a opýtaj sa, či to sedí alebo treba niečo upraviť.

Nikdy nevymýšľaj goalId — vždy použi presne to, čo ti vrátil create_goal alebo list_goals. Odpovedaj krátko, ako v prirodzenom chate, nie ako dlhý článok.`;

const tools: Anthropic.Tool[] = [
  {
    name: "list_goals",
    description: "Zoznam existujúcich cieľov používateľa (id, názov, oblasť, stav) — použi pred vytvorením nového cieľa, aby si predišiel duplicitám.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "create_goal",
    description: "Vytvorí nový cieľ priamo v aplikácii.",
    input_schema: {
      type: "object",
      properties: {
        domain: { type: "string", enum: [...LIFE_DOMAINS], description: "Oblasť života" },
        title: { type: "string", description: "Krátky, konkrétny názov cieľa" },
        description: { type: "string", description: "Voliteľný dlhší popis" },
        targetDate: { type: "string", description: "Voliteľný termín vo formáte YYYY-MM-DD" },
        weeklyTargetMinutes: { type: "number", description: "Voliteľný týždenný časový rozpočet v minútach" },
      },
      required: ["domain", "title"],
      additionalProperties: false,
    },
  },
  {
    name: "create_step",
    description: "Pridá konkrétny krok/úlohu k existujúcemu cieľu (identifikovanému cez goalId z create_goal alebo list_goals).",
    input_schema: {
      type: "object",
      properties: {
        goalId: { type: "string" },
        title: { type: "string" },
        estimatedMinutes: { type: "number", description: "Odhadovaný čas na jeden výskyt v minútach" },
        priority: { type: "number", description: "1-5, predvolene 3" },
        freq: { type: "string", enum: ["once", "daily", "weekly", "monthly"] },
      },
      required: ["goalId", "title", "estimatedMinutes", "freq"],
      additionalProperties: false,
    },
  },
];

export interface AiAction {
  type: "create_goal" | "create_step";
  goalId: string;
  stepId?: string;
  title: string;
}

async function executeTool(
  workspaceId: string,
  name: string,
  input: unknown,
  actions: AiAction[]
): Promise<unknown> {
  if (name === "list_goals") {
    const goals = await prisma.goal.findMany({
      where: { workspaceId },
      select: { id: true, title: true, domain: true, status: true },
      orderBy: { createdAt: "desc" },
    });
    return goals;
  }

  if (name === "create_goal") {
    const data = input as { domain: string; title: string; description?: string; targetDate?: string; weeklyTargetMinutes?: number };
    if (!LIFE_DOMAINS.includes(data.domain as (typeof LIFE_DOMAINS)[number])) {
      return { error: `Neplatná oblasť: ${data.domain}` };
    }
    const goal = await prisma.goal.create({
      data: {
        workspaceId,
        domain: data.domain,
        title: data.title,
        description: data.description,
        targetDate: data.targetDate,
        weeklyTargetMinutes: data.weeklyTargetMinutes,
      },
    });
    actions.push({ type: "create_goal", goalId: goal.id, title: goal.title });
    return { id: goal.id, title: goal.title, domain: goal.domain };
  }

  if (name === "create_step") {
    const data = input as { goalId: string; title: string; estimatedMinutes: number; priority?: number; freq: RecurrenceFrequency };
    const goal = await prisma.goal.findFirst({ where: { id: data.goalId, workspaceId } });
    if (!goal) return { error: `Cieľ s id ${data.goalId} neexistuje v tomto workspace.` };
    const step = await prisma.step.create({
      data: {
        workspaceId,
        goalId: data.goalId,
        domain: goal.domain,
        title: data.title,
        estimatedMinutes: data.estimatedMinutes,
        priority: data.priority ?? 3,
        ...recurrenceToRow({ freq: data.freq }),
      },
    });
    actions.push({ type: "create_step", goalId: data.goalId, stepId: step.id, title: step.title });
    return toDomainStep(step);
  }

  return { error: `Neznámy nástroj: ${name}` };
}

export interface AiTurnResult {
  reply: string;
  actions: AiAction[];
}

export async function runAssistantTurn(
  workspaceId: string,
  history: Anthropic.MessageParam[],
  userMessage: string
): Promise<AiTurnResult> {
  const anthropic = getClient();
  if (!anthropic) throw new Error("AI assistant not configured (missing ANTHROPIC_API_KEY)");

  const messages: Anthropic.MessageParam[] = [...history, { role: "user", content: userMessage }];
  const actions: AiAction[] = [];

  for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      tools,
      messages,
    });

    const toolUseBlocks = response.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
    );

    if (toolUseBlocks.length === 0) {
      const text = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n")
        .trim();
      return { reply: text || "…", actions };
    }

    messages.push({ role: "assistant", content: response.content });

    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const block of toolUseBlocks) {
      const result = await executeTool(workspaceId, block.name, block.input, actions);
      toolResults.push({ type: "tool_result", tool_use_id: block.id, content: JSON.stringify(result) });
    }
    messages.push({ role: "user", content: toolResults });
  }

  return { reply: "Ospravedlňujem sa, stratil som sa v návrhu — skús mi napísať, čo presne chceš, ešte raz.", actions };
}
