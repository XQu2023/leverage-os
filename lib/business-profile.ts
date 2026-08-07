export type BusinessProfile = {
  yearlyGoal: string;
  industry: string;
  businessModel: string;
  currentStage: string;
  coreAdvantage: string;
  currentConstraint: string;
  decisionPrinciples: string;
  recentProjects: string[];
  recentSuccesses: string[];
  recentFailures: string[];
  mostValuableAssets: string[];
  last30DaysFocus: string[];
};

export type BusinessMemorySource = {
  goal: string;
  decisionHistory: Array<{
    date?: string;
    chosenAction?: string;
    completionStatus?: string;
    score?: number;
    biggestWaste?: string;
    ledger?: { outcome?: string };
  }>;
  reviews: Array<{
    date?: string;
    action?: string;
    bestAsset?: string;
    tomorrowFocus?: string;
    biggestWaste?: string;
  }>;
  selectedAssets: string[];
  assetDrafts: Array<{ title?: string; status?: string }>;
};

export function emptyBusinessProfile(): BusinessProfile {
  return {
    yearlyGoal: "",
    industry: "",
    businessModel: "",
    currentStage: "",
    coreAdvantage: "",
    currentConstraint: "",
    decisionPrinciples: "",
    recentProjects: [],
    recentSuccesses: [],
    recentFailures: [],
    mostValuableAssets: [],
    last30DaysFocus: [],
  };
}

export function normalizeBusinessProfile(value: unknown, goal = ""): BusinessProfile {
  const source = isRecord(value) ? value : {};
  return {
    yearlyGoal: asString(source.yearlyGoal) || goal,
    industry: asString(source.industry),
    businessModel: asString(source.businessModel),
    currentStage: asString(source.currentStage),
    coreAdvantage: asString(source.coreAdvantage),
    currentConstraint: asString(source.currentConstraint),
    decisionPrinciples: asString(source.decisionPrinciples),
    recentProjects: asStringList(source.recentProjects),
    recentSuccesses: asStringList(source.recentSuccesses),
    recentFailures: asStringList(source.recentFailures),
    mostValuableAssets: asStringList(source.mostValuableAssets),
    last30DaysFocus: asStringList(source.last30DaysFocus),
  };
}

export function deriveBusinessMemory(source: BusinessMemorySource, now = new Date()): Pick<
  BusinessProfile,
  "recentProjects" | "recentSuccesses" | "recentFailures" | "mostValuableAssets" | "last30DaysFocus"
> {
  const recent = withinDays(source.decisionHistory, 30, now);
  const recentReviews = withinDays(source.reviews, 30, now);

  const recentProjects = uniqueTexts(recent.map((entry) => entry.chosenAction)).slice(0, 5);
  const recentSuccesses = uniqueTexts([
    ...recent
      .filter((entry) => entry.completionStatus === "completed" || entry.ledger?.outcome === "happened")
      .map((entry) => entry.chosenAction),
    ...recent
      .filter((entry) => typeof entry.score === "number" && entry.score >= 85 && entry.completionStatus === "completed")
      .map((entry) => entry.chosenAction),
  ]).slice(0, 5);
  const recentFailures = uniqueTexts([
    ...recent
      .filter((entry) => entry.completionStatus === "failed" || entry.completionStatus === "partial" || entry.ledger?.outcome === "did-not-happen")
      .map((entry) => entry.biggestWaste || entry.chosenAction),
    ...recentReviews.map((review) => review.biggestWaste),
  ]).slice(0, 5);
  const mostValuableAssets = uniqueTexts([
    ...source.selectedAssets,
    ...source.assetDrafts.filter((draft) => draft.status === "saved").map((draft) => draft.title),
    ...source.reviews.map((review) => review.bestAsset),
  ]).slice(0, 5);
  const last30DaysFocus = uniqueTexts([
    ...recentReviews.map((review) => review.tomorrowFocus),
    ...recent.map((entry) => entry.chosenAction),
    source.goal,
  ]).slice(0, 5);

  return { recentProjects, recentSuccesses, recentFailures, mostValuableAssets, last30DaysFocus };
}

export function refreshBusinessProfile(profile: BusinessProfile, source: BusinessMemorySource, now = new Date()): BusinessProfile {
  return {
    ...normalizeBusinessProfile(profile, source.goal),
    yearlyGoal: source.goal.trim() || profile.yearlyGoal,
    ...deriveBusinessMemory(source, now),
  };
}

export function businessMemoryKey(profile: BusinessProfile) {
  return JSON.stringify({
    recentProjects: profile.recentProjects,
    recentSuccesses: profile.recentSuccesses,
    recentFailures: profile.recentFailures,
    mostValuableAssets: profile.mostValuableAssets,
    last30DaysFocus: profile.last30DaysFocus,
  });
}

function withinDays<T extends { date?: string }>(values: T[], days: number, now: Date): T[] {
  const start = new Date(now);
  start.setDate(start.getDate() - (days - 1));
  start.setHours(0, 0, 0, 0);
  return values.filter((value) => {
    if (!value.date) return false;
    const date = new Date(value.date);
    return !Number.isNaN(date.getTime()) && date >= start && date <= now;
  });
}

function uniqueTexts(values: Array<string | undefined>) {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const text = value?.trim();
    if (!text || seen.has(text)) continue;
    seen.add(text);
    result.push(text);
  }
  return result;
}

function asString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function asStringList(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim()) : [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
