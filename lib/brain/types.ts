export type BrainInput = {
  goal: string;
  action: string;
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
}

export type BrainProviderId = "rules" | "openai" | "claude" | "gemini";
