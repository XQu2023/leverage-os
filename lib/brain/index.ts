import { ClaudeBrainProvider, GeminiBrainProvider, OpenAIBrainProvider, RuleBrainProvider } from "./providers.ts";
import type { Brain, BrainMode } from "./types.ts";

export type { Brain, BrainContext, BrainInput, BrainMetadata, BrainMode, BrainOutput, BrainProviderId, BrainStructuredOutput, BrainTask, BrainTrace, BrainValidation } from "./types.ts";
export { ClaudeBrainProvider, GeminiBrainProvider, OpenAIBrainProvider, RuleBrainProvider } from "./providers.ts";
export { ContextBuilder } from "./context-builder.ts";
export { PROMPT_VERSIONS, PromptBuilder } from "./prompt-builder.ts";
export { BRAIN_OUTPUT_FIELDS, BRAIN_OUTPUT_JSON_SCHEMA, parseBrainOutput, validateBrainEvaluation } from "./schema.ts";

export const BRAIN_OPTIONS: ReadonlyArray<{ id: BrainMode; label: string }> = [
  { id: "auto", label: "Auto" },
  { id: "rules", label: "Rules" },
  { id: "openai", label: "OpenAI" },
  { id: "claude", label: "Claude (mock)" },
  { id: "gemini", label: "Gemini (mock)" },
];

export function createBrain(provider: BrainMode): Brain {
  if (provider === "auto") return new OpenAIBrainProvider();
  if (provider === "openai") return new OpenAIBrainProvider();
  if (provider === "claude") return new ClaudeBrainProvider();
  if (provider === "gemini") return new GeminiBrainProvider();
  return new RuleBrainProvider();
}
