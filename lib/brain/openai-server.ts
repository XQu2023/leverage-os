import { decisionEngine } from "../decision-engine.ts";
import { PromptBuilder } from "./prompt-builder.ts";
import { BRAIN_OUTPUT_JSON_SCHEMA, parseBrainOutput, validateBrainEvaluation } from "./schema.ts";
import type { BrainInput, BrainOutput } from "./types.ts";

const promptBuilder = new PromptBuilder();
const DEFAULT_MODEL = "gpt-5.6";

type FetchLike = typeof fetch;
type OpenAIOptions = { apiKey?: string; model?: string; fetchImpl?: FetchLike; now?: () => number };
type Usage = NonNullable<BrainOutput["metadata"]["tokenUsage"]>;

export type OpenAIEvaluationResponse = { output: BrainOutput; prompt: string; rawResponse: string };

export async function evaluateOpenAIDecision(input: BrainInput, options: OpenAIOptions = {}): Promise<OpenAIEvaluationResponse> {
  const apiKey = options.apiKey ?? process.env.OPENAI_API_KEY;
  const model = options.model ?? process.env.OPENAI_MODEL ?? DEFAULT_MODEL;
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? (() => performance.now());
  const prompt = promptBuilder.build("decision", input.context);
  const started = now();
  let usage: Usage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
  let lastRaw = "";

  if (apiKey) {
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        const response = await fetchImpl("https://api.openai.com/v1/responses", {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model,
            instructions: "You are the Leverage OS decision evaluator. Follow the supplied prompt and return only the required structured result.",
            input: prompt,
            text: { format: { type: "json_schema", name: "brain_decision", strict: true, schema: BRAIN_OUTPUT_JSON_SCHEMA } },
          }),
        });
        if (!response.ok) throw new Error(`OpenAI returned ${response.status}`);
        const payload = await response.json() as Record<string, unknown>;
        usage = addUsage(usage, readUsage(payload.usage));
        lastRaw = extractOutputText(payload);
        const parsed = parseBrainOutput(lastRaw);
        validateBrainEvaluation(parsed);
        return {
          prompt,
          rawResponse: lastRaw,
          output: { ...parsed, metadata: { provider: "openai", latencyMs: Math.round(now() - started), tokenUsage: usage, fallback: false, attempts: attempt, promptVersion: promptBuilder.version("decision") } },
        };
      } catch {
        // Retry once. A second failure falls through to the deterministic provider.
      }
    }
  }

  const fallback = decisionEngine(input.context.yearlyGoal, input.context.todayAction);
  return {
    prompt,
    rawResponse: lastRaw || JSON.stringify(fallback),
    output: { ...fallback, metadata: { provider: "rules", latencyMs: Math.round(now() - started), tokenUsage: usage.totalTokens ? usage : null, fallback: true, attempts: apiKey ? 2 : 0, promptVersion: promptBuilder.version("decision") } },
  };
}

function extractOutputText(payload: Record<string, unknown>): string {
  if (typeof payload.output_text === "string") return payload.output_text;
  if (!Array.isArray(payload.output)) throw new Error("OpenAI response has no output");
  for (const item of payload.output) {
    if (!isRecord(item) || !Array.isArray(item.content)) continue;
    for (const content of item.content) {
      if (isRecord(content) && content.type === "output_text" && typeof content.text === "string") return content.text;
    }
  }
  throw new Error("OpenAI response has no output text");
}

function readUsage(value: unknown): Usage {
  if (!isRecord(value)) return { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
  return {
    inputTokens: numberOrZero(value.input_tokens),
    outputTokens: numberOrZero(value.output_tokens),
    totalTokens: numberOrZero(value.total_tokens),
  };
}

function addUsage(left: Usage, right: Usage): Usage {
  return { inputTokens: left.inputTokens + right.inputTokens, outputTokens: left.outputTokens + right.outputTokens, totalTokens: left.totalTokens + right.totalTokens };
}

function numberOrZero(value: unknown): number { return typeof value === "number" && Number.isFinite(value) ? value : 0; }
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
