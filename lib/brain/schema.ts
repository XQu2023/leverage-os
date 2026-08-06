import type { BrainStructuredOutput } from "./types.ts";

export const BRAIN_OUTPUT_FIELDS = [
  "outcome", "score", "verdict", "recommendation", "whyToday", "biggestRisk",
  "higherLeverageAlternative", "todayDeliverable", "reasoning",
  "confidence", "experiment", "opportunityCost", "counterfactual",
] as const;

export const BRAIN_OUTPUT_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [...BRAIN_OUTPUT_FIELDS],
  properties: {
    outcome: { type: "string", enum: ["Execute", "Refine", "Reject Today"] },
    score: { type: "number", minimum: 0, maximum: 100 },
    verdict: { type: "string" },
    recommendation: { type: "string" },
    whyToday: { type: "string" },
    biggestRisk: { type: "string" },
    higherLeverageAlternative: { type: ["string", "null"] },
    todayDeliverable: { type: "string" },
    confidence: { type: "number", minimum: 0, maximum: 100 },
    experiment: { type: "string" },
    opportunityCost: { type: "string" },
    counterfactual: { type: "string" },
    reasoning: {
      type: "object",
      additionalProperties: false,
      required: ["score", "risk", "recommendation"],
      properties: {
        score: { type: "array", minItems: 1, items: { type: "string" } },
        risk: { type: "string" },
        recommendation: { type: "string" },
      },
    },
  },
} as const;

export function parseBrainOutput(rawResponse: string): BrainStructuredOutput {
  const value: unknown = JSON.parse(rawResponse);
  if (!isRecord(value)) throw new Error("Brain output must be a JSON object");
  if (!BRAIN_OUTPUT_FIELDS.every((field) => field in value)) throw new Error("Brain output is missing required fields");
  if (value.outcome !== "Execute" && value.outcome !== "Refine" && value.outcome !== "Reject Today") throw new Error("Invalid Brain outcome");
  if (typeof value.score !== "number" || value.score < 0 || value.score > 100) throw new Error("Invalid Brain score");
  if (typeof value.confidence !== "number" || value.confidence < 0 || value.confidence > 100) throw new Error("Invalid Brain confidence");
  for (const field of ["verdict", "recommendation", "whyToday", "biggestRisk", "todayDeliverable", "experiment", "opportunityCost", "counterfactual"] as const) {
    if (typeof value[field] !== "string" || !value[field].trim()) throw new Error(`Invalid Brain field: ${field}`);
  }
  if (value.higherLeverageAlternative !== null && typeof value.higherLeverageAlternative !== "string") throw new Error("Invalid higher-leverage alternative");
  if (!isRecord(value.reasoning) || !Array.isArray(value.reasoning.score) || value.reasoning.score.length === 0 || !value.reasoning.score.every((item) => typeof item === "string" && item.trim()) || typeof value.reasoning.risk !== "string" || !value.reasoning.risk.trim() || typeof value.reasoning.recommendation !== "string" || !value.reasoning.recommendation.trim()) throw new Error("Invalid Brain reasoning");
  return value as BrainStructuredOutput;
}

export function validateBrainEvaluation(output: BrainStructuredOutput): void {
  if (output.reasoning.score.length < 2) throw new Error("Brain reasoning must explain at least two score factors");
  const measurable = /\d|链接|页面|反馈|用户|发布|完成|记录|份|个|次|link|page|feedback|user|publish|complete|record/i;
  if (!measurable.test(output.todayDeliverable)) throw new Error("Brain deliverable must be concrete and measurable");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
