import OpenAI from "openai";
import { z } from "zod";
import { db } from "@/db";
import { aiCalls } from "@/db/schema";

const extractionSchema = z.object({ summary: z.string(), goals: z.array(z.object({ domain: z.string(), text: z.string(), baseline: z.string().optional(), criterion: z.string().optional() })), services: z.string(), accommodations: z.array(z.string()) });
const summarySchema = z.object({ clinicalNote: z.string(), parentSummary: z.string(), homePractice: z.string() });
const nextStepsSchema = z.object({ items: z.array(z.object({ goalId: z.string(), action: z.enum(["continue", "advance", "introduce", "pause"]), rationale: z.string(), activities: z.array(z.string()).length(2) })), overview: z.string() });

export const aiSchemas = { extract_iep: extractionSchema, session_summary: summarySchema, next_steps: nextStepsSchema };
export type AiTask = keyof typeof aiSchemas;
const models: Record<AiTask, string> = { extract_iep: process.env.OPENROUTER_IEP_MODEL ?? "anthropic/claude-sonnet-4.5", session_summary: process.env.OPENROUTER_SUMMARY_MODEL ?? "openai/gpt-4.1-mini", next_steps: process.env.OPENROUTER_PLANNING_MODEL ?? "anthropic/claude-sonnet-4.5" };
const prompts: Record<AiTask, string> = {
  extract_iep: "Extract a concise pre-session summary, speech/language goals, services, and accommodations from this IEP or evaluation. Never diagnose or invent missing values.",
  session_summary: "Draft a factual clinical session note and warm parent-friendly summary. Include exactly one practical home activity. Do not add observations absent from the input.",
  next_steps: "Rank what to work on next from active goals and observed progress. Choose continue, advance, introduce, or pause for every recommendation and offer two feasible activities.",
};

function redactName(input: unknown, clientName?: string) {
  const raw = JSON.stringify(input);
  return clientName ? raw.replaceAll(clientName, "the client") : raw;
}

export async function ask<T extends AiTask>(task: T, input: unknown, options: { clinicId: string; clientName?: string }) : Promise<z.infer<(typeof aiSchemas)[T]>> {
  if (!process.env.OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY is not configured");
  const started = Date.now(); const model = models[task]; let usage = { prompt_tokens: 0, completion_tokens: 0 }; let ok = false;
  try {
    const client = new OpenAI({ apiKey: process.env.OPENROUTER_API_KEY, baseURL: "https://openrouter.ai/api/v1", defaultHeaders: { "HTTP-Referer": process.env.BETTER_AUTH_URL ?? "http://localhost:3000", "X-Title": "Sayso" } });
    let lastError: unknown;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const requestBody: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming & { provider: { data_collection: "deny"; zdr: boolean } } = { model, messages: [{ role: "system", content: `${prompts[task]} Return only valid JSON matching the requested schema.` }, { role: "user", content: redactName(input, options.clientName) }], response_format: { type: "json_object" }, provider: { data_collection: "deny", zdr: true } };
        const response = await client.chat.completions.create(requestBody);
        usage = { prompt_tokens: response.usage?.prompt_tokens ?? 0, completion_tokens: response.usage?.completion_tokens ?? 0 };
        const parsed = aiSchemas[task].parse(JSON.parse(response.choices[0]?.message.content ?? "{}")); ok = true;
        return parsed as z.infer<(typeof aiSchemas)[T]>;
      } catch (error) { lastError = error; }
    }
    throw lastError;
  } finally {
    await db.insert(aiCalls).values({ clinicId: options.clinicId, task, model, tokensIn: usage.prompt_tokens, tokensOut: usage.completion_tokens, ms: Date.now() - started, ok }).catch(() => undefined);
  }
}
