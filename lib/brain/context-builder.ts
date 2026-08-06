import type { BrainContext, BrainProviderId } from "./types.ts";

type ContextSource = {
  yearlyGoal: string;
  todayAction: string;
  decisionHistory: unknown[];
  assets: unknown[];
  reviews: unknown[];
  selectedProvider: BrainProviderId;
};

export class ContextBuilder {
  constructor(privateLimit = 5) {
    this.limit = privateLimit;
  }

  readonly limit: number;

  build(source: ContextSource): BrainContext {
    return {
      yearlyGoal: source.yearlyGoal.trim(),
      todayAction: source.todayAction.trim(),
      recentDecisionHistory: toRecords(source.decisionHistory, this.limit),
      recentAssets: toRecords(source.assets, this.limit),
      recentReviews: toRecords(source.reviews, this.limit),
      selectedProvider: source.selectedProvider,
    };
  }
}

function toRecords(values: unknown[], limit: number): Array<Record<string, unknown>> {
  return values.filter((value): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value)).slice(0, limit);
}
