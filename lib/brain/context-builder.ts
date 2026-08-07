import { normalizeBusinessProfile, type BusinessProfile } from "../business-profile.ts";
import type { BrainContext, BrainProviderId } from "./types.ts";

type ContextSource = {
  yearlyGoal: string;
  todayAction: string;
  businessProfile?: BusinessProfile | null;
  decisionHistory: unknown[];
  assets: unknown[];
  reviews: unknown[];
  selectedProvider: BrainProviderId;
};

export class ContextBuilder {
  constructor(privateLimit = 30, resourceLimit = Math.min(privateLimit, 5)) {
    this.limit = privateLimit;
    this.resourceLimit = resourceLimit;
  }

  readonly limit: number;
  readonly resourceLimit: number;

  build(source: ContextSource): BrainContext {
    const yearlyGoal = source.yearlyGoal.trim();
    return {
      yearlyGoal,
      todayAction: source.todayAction.trim(),
      businessProfile: normalizeBusinessProfile(source.businessProfile, yearlyGoal),
      recentDecisionHistory: toRecords(source.decisionHistory, this.limit),
      recentAssets: toRecords(source.assets, this.resourceLimit),
      recentReviews: toRecords(source.reviews, this.resourceLimit),
      predictionAccuracy: predictionAccuracy(source.decisionHistory),
      recurringMistakes: recurringMistakes(source.decisionHistory),
      selectedProvider: source.selectedProvider,
    };
  }
}

function predictionAccuracy(values: unknown[]): number {
  const outcomes = toRecords(values, 30)
    .map((entry) => isRecord(entry.ledger) ? entry.ledger.outcome : undefined)
    .filter((outcome) => outcome === "happened" || outcome === "partial" || outcome === "did-not-happen");
  if (!outcomes.length) return 0;
  const correct = outcomes.reduce((total, outcome) => total + (outcome === "happened" ? 1 : outcome === "partial" ? 0.5 : 0), 0);
  return Math.round((correct / outcomes.length) * 100);
}

function recurringMistakes(values: unknown[]): string[] {
  const counts = new Map<string, number>();
  for (const entry of toRecords(values, 30)) {
    const mistake = isRecord(entry.ledger) && typeof entry.ledger.wrongAssumption === "string" ? entry.ledger.wrongAssumption.trim() : "";
    if (mistake) counts.set(mistake, (counts.get(mistake) ?? 0) + 1);
  }
  return [...counts.entries()].filter(([, count]) => count > 1).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([mistake]) => mistake);
}

function toRecords(values: unknown[], limit: number): Array<Record<string, unknown>> {
  return values.filter((value): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value)).slice(0, limit);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
