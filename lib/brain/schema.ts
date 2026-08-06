import type { BrainOutput } from "./types.ts";

export const BRAIN_OUTPUT_FIELDS = [
  "outcome", "score", "verdict", "recommendation", "whyToday", "biggestRisk",
  "higherLeverageAlternative", "todayDeliverable", "reasoning",
] as const;

export function parseBrainOutput(rawResponse: string): BrainOutput {
  const value: unknown = JSON.parse(rawResponse);
  if (!isRecord(value)) throw new Error("Brain output must be a JSON object");
  if (!BRAIN_OUTPUT_FIELDS.every((field) => field in value)) throw new Error("Brain output is missing required fields");
  if (value.outcome !== "Execute" && value.outcome !== "Refine" && value.outcome !== "Reject Today") throw new Error("Invalid Brain outcome");
  if (typeof value.score !== "number" || value.score < 0 || value.score > 100) throw new Error("Invalid Brain score");
  for (const field of ["verdict", "recommendation", "whyToday", "biggestRisk", "todayDeliverable"] as const) {
    if (typeof value[field] !== "string") throw new Error(`Invalid Brain field: ${field}`);
  }
  if (value.higherLeverageAlternative !== null && typeof value.higherLeverageAlternative !== "string") throw new Error("Invalid higher-leverage alternative");
  if (!isRecord(value.reasoning) || !Array.isArray(value.reasoning.score) || !value.reasoning.score.every((item) => typeof item === "string") || typeof value.reasoning.risk !== "string" || typeof value.reasoning.recommendation !== "string") throw new Error("Invalid Brain reasoning");
  return value as BrainOutput;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
