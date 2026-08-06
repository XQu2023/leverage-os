import { ClaudeBrainProvider, GeminiBrainProvider, OpenAIBrainProvider, RuleBrainProvider } from "./providers.ts";
import type { Brain, BrainProviderId } from "./types.ts";

export type { Brain, BrainInput, BrainOutput, BrainProviderId } from "./types.ts";
export { ClaudeBrainProvider, GeminiBrainProvider, OpenAIBrainProvider, RuleBrainProvider } from "./providers.ts";

export const BRAIN_OPTIONS: ReadonlyArray<{ id: BrainProviderId; label: string }> = [
  { id: "rules", label: "Rules" },
  { id: "openai", label: "OpenAI" },
  { id: "claude", label: "Claude" },
  { id: "gemini", label: "Gemini" },
];

export function createBrain(provider: BrainProviderId): Brain {
  if (provider === "openai") return new OpenAIBrainProvider();
  if (provider === "claude") return new ClaudeBrainProvider();
  if (provider === "gemini") return new GeminiBrainProvider();
  return new RuleBrainProvider();
}
