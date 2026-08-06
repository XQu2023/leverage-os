import type { BrainContext, BrainTask } from "./types.ts";

const TEMPLATE_INSTRUCTIONS: Record<BrainTask, string> = {
  decision: "Evaluate today's action. Return Execute, Refine, or Reject Today with score, risk, recommendation, and one measurable deliverable.",
  multiplier: "Find one mechanism that makes today's result reusable or compounding.",
  asset: "Create an editable asset draft grounded in today's action and recent assets.",
  review: "Explain the result, identify the main failure pattern, and recommend tomorrow's smallest verifiable action.",
};

export class PromptBuilder {
  build(task: BrainTask, context: BrainContext): string {
    return [
      `TASK: ${task.toUpperCase()}`,
      TEMPLATE_INSTRUCTIONS[task],
      "Return JSON only. Use the shared BrainOutput schema with no additional top-level fields.",
      `CONTEXT:\n${JSON.stringify(context, null, 2)}`,
    ].join("\n\n");
  }
}
