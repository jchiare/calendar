import OpenAI from "openai";
import { z } from "zod";
import { db } from "@/db";
import { aiCalls } from "@/db/schema";

const extractionSchema = z.object({
  summary: z.string(),
  goals: z.array(
    z.object({
      domain: z.string(),
      text: z.string(),
      // Strict structured outputs require every key, so absent values are null.
      baseline: z.string().nullable(),
      criterion: z.string().nullable(),
    }),
  ),
  services: z.string(),
  accommodations: z.array(z.string()),
});
const summarySchema = z.object({
  clinicalNote: z.string(),
  parentSummary: z.string(),
  homePractice: z.string(),
});
const nextStepsSchema = z.object({
  items: z.array(
    z.object({
      goalId: z.string(),
      action: z.enum(["continue", "advance", "introduce", "pause"]),
      rationale: z.string(),
      activities: z.array(z.string()).length(2),
    }),
  ),
  overview: z.string(),
});

export const taskSchemas = {
  extract_iep: extractionSchema,
  session_summary: summarySchema,
  next_steps: nextStepsSchema,
};
export type AiTask = keyof typeof taskSchemas;

const modelsByTask: Record<AiTask, string> = {
  extract_iep: process.env.OPENROUTER_IEP_MODEL ?? "openai/gpt-5.4",
  session_summary: process.env.OPENROUTER_SUMMARY_MODEL ?? "openai/gpt-5.4-mini",
  next_steps: process.env.OPENROUTER_PLANNING_MODEL ?? "openai/gpt-5.4",
};

const systemPromptsByTask: Record<AiTask, string> = {
  extract_iep:
    "Extract a concise pre-session summary, speech/language goals, services, and accommodations from this IEP or evaluation. Never diagnose or invent missing values.",
  session_summary:
    "Draft a factual clinical session note and warm parent-friendly summary. Include exactly one practical home activity. Do not add observations absent from the input.",
  next_steps:
    "Rank what to work on next from active goals and observed progress. Choose continue, advance, introduce, or pause for every recommendation and offer two feasible activities.",
};

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Notes usually mention the child by first name only, so redact the full name
// first and then each part of it.
function redactClientName(text: string, clientName?: string) {
  const names = [clientName, ...(clientName?.split(/\s+/) ?? [])]
    .map((name) => name?.trim())
    .filter((name): name is string => Boolean(name && name.length > 1));
  return names.reduce(
    (redacted, name) =>
      redacted.replace(new RegExp(`\\b${escapeRegExp(name)}\\b`, "gi"), "the client"),
    text,
  );
}

type UserContent = OpenAI.Chat.Completions.ChatCompletionUserMessageParam["content"];

// Scanned pages are sent as image parts; everything else is sent as JSON text.
function buildUserContent(input: unknown, clientName?: string): UserContent {
  const scannedPages =
    input && typeof input === "object" && "scannedPagePngsBase64" in input
      ? (input as { scannedPagePngsBase64: string[] }).scannedPagePngsBase64
      : undefined;
  if (!scannedPages) return redactClientName(JSON.stringify(input), clientName);
  return [
    { type: "text", text: "These are the scanned pages of the document, in order." },
    ...scannedPages.map((page) => ({
      type: "image_url" as const,
      image_url: { url: `data:image/png;base64,${page}` },
    })),
  ];
}

function toStrictJsonSchema(task: AiTask) {
  // OpenAI accepts the schema body without the JSON Schema dialect marker.
  const schema: Record<string, unknown> = z.toJSONSchema(taskSchemas[task]);
  delete schema.$schema;
  return schema;
}

export async function ask<T extends AiTask>(
  task: T,
  input: unknown,
  options: { clinicId: string; clientName?: string },
): Promise<z.infer<(typeof taskSchemas)[T]>> {
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error("OPENROUTER_API_KEY is not configured");
  }

  const startedAt = Date.now();
  const model = modelsByTask[task];
  let tokenUsage = { input: 0, output: 0 };
  let succeeded = false;

  try {
    const openRouter = new OpenAI({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: "https://openrouter.ai/api/v1",
      defaultHeaders: {
        "HTTP-Referer": process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
        "X-Title": "Sayso",
      },
    });
    let finalError: unknown;

    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const requestBody: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming & {
          provider: { data_collection: "deny"; zdr: boolean };
        } = {
          model,
          messages: [
            {
              role: "system",
              content: systemPromptsByTask[task],
            },
            {
              role: "user",
              content: buildUserContent(input, options.clientName),
            },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: task,
              strict: true,
              schema: toStrictJsonSchema(task),
            },
          },
          provider: { data_collection: "deny", zdr: true },
        };

        const response = await openRouter.chat.completions.create(requestBody);
        tokenUsage = {
          input: response.usage?.prompt_tokens ?? 0,
          output: response.usage?.completion_tokens ?? 0,
        };

        const parsedResponse = taskSchemas[task].parse(
          JSON.parse(response.choices[0]?.message.content ?? "{}"),
        );
        succeeded = true;
        return parsedResponse as z.infer<(typeof taskSchemas)[T]>;
      } catch (error) {
        finalError = error;
      }
    }

    throw finalError;
  } finally {
    await db
      .insert(aiCalls)
      .values({
        clinicId: options.clinicId,
        task,
        model,
        tokensIn: tokenUsage.input,
        tokensOut: tokenUsage.output,
        ms: Date.now() - startedAt,
        ok: succeeded,
      })
      .catch(() => undefined);
  }
}
