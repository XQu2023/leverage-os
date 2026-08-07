import type { BrainContext, BrainTask } from "./types.ts";

const TEMPLATE_INSTRUCTIONS: Record<BrainTask, string> = {
  decision: "Evaluate today's action. Return Execute, Refine, or Reject Today with score, confidence as 0-100 percent (not 0-1), risk, recommendation, one measurable experiment and deliverable, opportunity cost phrased as abandon cost (what delayed feedback or progress happens if skipped today), and counterfactual.",
  multiplier: "Find one mechanism that makes today's result reusable or compounding.",
  asset: "Create an editable asset draft grounded in today's action and recent assets.",
  review: "Explain the result, identify the main failure pattern, and recommend tomorrow's smallest verifiable action.",
};

export const PROMPT_VERSIONS: Record<BrainTask, string> = {
  decision: "decision.v2",
  multiplier: "multiplier.v1",
  asset: "asset.v1",
  review: "review.v1",
};

export class PromptBuilder {
  build(task: BrainTask, context: BrainContext): string {
    return [
      `PROMPT_VERSION: ${this.version(task)}`,
      `TASK: ${task.toUpperCase()}`,
      TEMPLATE_INSTRUCTIONS[task],
      "Return JSON only. Use the shared BrainOutput schema with no additional top-level fields.",
      `CONTEXT:\n${JSON.stringify(context, null, 2)}`,
    ].join("\n\n");
  }

  version(task: BrainTask): string {
    return PROMPT_VERSIONS[task];
  }
}
