export type BrainTask = "decision" | "multiplier" | "asset" | "review";

export type BrainContext = {
  yearlyGoal: string;
  todayAction: string;
  recentDecisionHistory: Array<Record<string, unknown>>;
  recentAssets: Array<Record<string, unknown>>;
  recentReviews: Array<Record<string, unknown>>;
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

export type BrainOutput = {
  outcome: "Execute" | "Refine" | "Reject Today";
  score: number;
  verdict: string;
  recommendation: string;
  whyToday: string;
  biggestRisk: string;
  higherLeverageAlternative: string | null;
  todayDeliverable: string;
  reasoning: BrainReasoning;
};

export interface Brain {
  evaluate(input: BrainInput): Promise<BrainOutput>;
  inspect(input: BrainInput): Promise<BrainTrace>;
}

export type BrainTrace = {
  context: BrainContext;
  prompt: string;
  rawResponse: string;
  parsedOutput: BrainOutput;
};

export type BrainProviderId = "rules" | "openai" | "claude" | "gemini";
