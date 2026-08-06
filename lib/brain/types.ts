export type BrainTask = "decision" | "multiplier" | "asset" | "review";

export type BrainContext = {
  yearlyGoal: string;
  todayAction: string;
  recentDecisionHistory: Array<Record<string, unknown>>;
  recentAssets: Array<Record<string, unknown>>;
  recentReviews: Array<Record<string, unknown>>;
  predictionAccuracy: number;
  recurringMistakes: string[];
  selectedProvider: BrainProviderId;
};

export type BrainInput = {
  task: BrainTask;
  context: BrainContext;
};

export type BrainReasoning = {
  score: string[];
  risk: string;
  recommendation: string;
};

export type BrainStructuredOutput = {
  outcome: "Execute" | "Refine" | "Reject Today";
  score: number;
  verdict: string;
  recommendation: string;
  whyToday: string;
  biggestRisk: string;
  higherLeverageAlternative: string | null;
  todayDeliverable: string;
  confidence: number;
  experiment: string;
  opportunityCost: string;
  counterfactual: string;
  reasoning: BrainReasoning;
};

export type BrainMetadata = {
  provider: BrainProviderId;
  model: string;
  latencyMs: number;
  tokenUsage: { inputTokens: number; outputTokens: number; totalTokens: number } | null;
  fallback: boolean;
  attempts: number;
  promptVersion: string;
  estimatedCostUsd: number;
};

export type BrainOutput = BrainStructuredOutput & { metadata: BrainMetadata };

export interface Brain {
  evaluate(input: BrainInput): Promise<BrainOutput>;
  inspect(input: BrainInput): Promise<BrainTrace>;
}

export type BrainTrace = {
  context: BrainContext;
  prompt: string;
  rawResponse: string;
  parsedOutput: BrainOutput;
  validation: BrainValidation;
};

export type BrainProviderId = "rules" | "openai" | "claude" | "gemini";
export type BrainMode = "auto" | BrainProviderId;

export type BrainValidation = {
  status: "passed" | "fallback";
  schema: boolean;
  reasoning: boolean;
  deliverable: boolean;
  message: string;
};
