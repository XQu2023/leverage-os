import { normalizeBusinessProfile } from "./business-profile.ts";

export const LATEST_STORAGE_VERSION = 8 as const;
export const STORAGE_KEY = "leverage-os-v1";
export const STORAGE_BACKUP_PREFIX = `${STORAGE_KEY}-backup-`;

type StoredRecord = Record<string, unknown> & { storageVersion: number };

export type StorageLike = Pick<Storage, "getItem" | "setItem">;

export function migrateStoredState(value: unknown): StoredRecord & { storageVersion: 8 } {
  if (!isRecord(value)) throw new Error("Stored state must be an object");
  let state: Record<string, unknown> = { ...value };
  let version = readVersion(state.storageVersion);

  if (version > LATEST_STORAGE_VERSION) throw new Error(`Unsupported storage version: ${version}`);

  if (version === 0) {
    state = {
      ...state,
      decisionHistory: Array.isArray(state.decisionHistory) ? state.decisionHistory : [],
      assetDrafts: Array.isArray(state.assetDrafts) ? state.assetDrafts : [],
      storageVersion: 1,
    };
    version = 1;
  }

  if (version === 1) {
    const history = Array.isArray(state.decisionHistory) ? state.decisionHistory : [];
    state = {
      ...state,
      decisionHistory: history.map(migrateDecisionEntry),
      assetDrafts: Array.isArray(state.assetDrafts) ? state.assetDrafts : [],
      completionResult: normalizeCompletionResult(state.completionResult, state.completed),
      storageVersion: 2,
    };
    version = 2;
  }

  if (version === 2) {
    const history = Array.isArray(state.decisionHistory) ? state.decisionHistory : [];
    state = {
      ...state,
      decisionHistory: history.map(migrateDecisionEntry),
      assetDrafts: Array.isArray(state.assetDrafts) ? state.assetDrafts : [],
      completed: false,
      completionResult: null,
      activeDecisionId: null,
      storageVersion: 3,
    };
    version = 3;
  }

  if (version === 3) {
    state = {
      ...state,
      brainProvider: normalizeBrainProvider(state.brainProvider),
      storageVersion: 4,
    };
    version = 4;
  }

  if (version === 4) {
    const history = Array.isArray(state.decisionHistory) ? state.decisionHistory : [];
    state = {
      ...state,
      decisionHistory: history.map(migrateDecisionEntry),
      brainProvider: "openai",
      storageVersion: 5,
    };
    version = 5;
  }

  if (version === 5) {
    state = {
      ...state,
      brainProvider: state.brainProvider === "openai" ? "auto" : normalizeBrainProvider(state.brainProvider),
      brainUsage: normalizeBrainUsage(state.brainUsage),
      storageVersion: 6,
    };
    version = 6;
  }

  if (version === 6) {
    const history = Array.isArray(state.decisionHistory) ? state.decisionHistory : [];
    const reviews = Array.isArray(state.reviews) ? state.reviews : [];
    state = {
      ...state,
      decisionHistory: history.map(migrateDecisionEntry),
      reviews: reviews.map(migrateReview),
      predictionResult: null,
      wrongAssumption: "",
      nextTimeChange: "",
      storageVersion: 7,
    };
    version = 7;
  }

  if (version === 7) {
    const goal = typeof state.goal === "string" ? state.goal : "";
    state = {
      ...state,
      businessProfile: normalizeBusinessProfile(state.businessProfile, goal),
      storageVersion: 8,
    };
    version = 8;
  }

  if (version !== LATEST_STORAGE_VERSION) throw new Error(`Migration stopped at version ${version}`);
  if (!Array.isArray(state.decisionHistory) || !Array.isArray(state.assetDrafts)) throw new Error("Migrated collections are invalid");
  state.brainProvider = normalizeBrainProvider(state.brainProvider);
  state.brainUsage = normalizeBrainUsage(state.brainUsage);
  state.businessProfile = normalizeBusinessProfile(state.businessProfile, typeof state.goal === "string" ? state.goal : "");
  return state as StoredRecord & { storageVersion: 8 };
}

export function loadStoredState<T extends { storageVersion: 8 }>(
  storage: StorageLike,
  initialState: T,
  now = Date.now(),
): T {
  const raw = storage.getItem(STORAGE_KEY);
  if (raw === null) {
    storage.setItem(STORAGE_KEY, JSON.stringify(initialState));
    return initialState;
  }

  try {
    const migrated = migrateStoredState(JSON.parse(raw));
    const next = {
      ...initialState,
      ...migrated,
      completed: false,
      completionResult: null,
      activeDecisionId: null,
    } as T;
    storage.setItem(STORAGE_KEY, JSON.stringify(next));
    return next;
  } catch {
    try {
      storage.setItem(`${STORAGE_BACKUP_PREFIX}${now}`, raw);
    } catch {}
    storage.setItem(STORAGE_KEY, JSON.stringify(initialState));
    return initialState;
  }
}

function migrateDecisionEntry(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) throw new Error("Decision history entry must be an object");
  const score = typeof value.score === "number" ? value.score : 0;
  const outcome = value.outcome === "Execute" || value.outcome === "Refine" || value.outcome === "Reject Today"
    ? value.outcome
    : score >= 78 ? "Execute" : "Refine";
  const completionStatus = value.completionStatus === "completed" || value.completionStatus === "partial" || value.completionStatus === "failed"
    ? value.completionStatus
    : "pending";
  const provider = value.provider === "openai" || value.provider === "claude" || value.provider === "gemini" ? value.provider : "rules";
  const tokenUsage = isRecord(value.tokenUsage)
    && typeof value.tokenUsage.inputTokens === "number"
    && typeof value.tokenUsage.outputTokens === "number"
    && typeof value.tokenUsage.totalTokens === "number"
    ? value.tokenUsage
    : null;
  const ledger = isRecord(value.ledger) ? value.ledger : {};
  const ledgerOutcome = ledger.outcome === "happened" || ledger.outcome === "partial" || ledger.outcome === "did-not-happen" ? ledger.outcome : "pending";
  return {
    ...value,
    outcome,
    completionStatus,
    provider,
    latencyMs: typeof value.latencyMs === "number" ? value.latencyMs : 0,
    tokenUsage,
    fallback: value.fallback === true,
    ledger: {
      decision: typeof ledger.decision === "string" ? ledger.decision : typeof value.chosenAction === "string" ? value.chosenAction : "",
      prediction: typeof ledger.prediction === "string" ? ledger.prediction : typeof value.aiRecommendation === "string" ? value.aiRecommendation : "",
      outcome: ledgerOutcome,
      confidence: typeof ledger.confidence === "number" ? ledger.confidence : score,
      lesson: typeof ledger.lesson === "string" ? ledger.lesson : "",
      wrongAssumption: typeof ledger.wrongAssumption === "string" ? ledger.wrongAssumption : "",
      nextTimeChange: typeof ledger.nextTimeChange === "string" ? ledger.nextTimeChange : "",
    },
  };
}

function migrateReview(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) throw new Error("Review entry must be an object");
  return {
    ...value,
    predictionResult: value.predictionResult === "happened" || value.predictionResult === "partial" ? value.predictionResult : "did-not-happen",
    wrongAssumption: typeof value.wrongAssumption === "string" ? value.wrongAssumption : "未记录",
    nextTimeChange: typeof value.nextTimeChange === "string" ? value.nextTimeChange : "未记录",
  };
}

function normalizeCompletionResult(value: unknown, completed: unknown) {
  if (value === "completed" || value === "partial" || value === "failed") return value;
  return completed === true ? "completed" : null;
}

function normalizeBrainProvider(value: unknown) {
  return value === "auto" || value === "openai" || value === "claude" || value === "gemini" ? value : "rules";
}

function normalizeBrainUsage(value: unknown) {
  if (!isRecord(value)) return { totalCalls: 0, inputTokens: 0, outputTokens: 0, totalTokens: 0, estimatedCostUsd: 0, fallbackCount: 0 };
  return {
    totalCalls: nonNegativeNumber(value.totalCalls),
    inputTokens: nonNegativeNumber(value.inputTokens),
    outputTokens: nonNegativeNumber(value.outputTokens),
    totalTokens: nonNegativeNumber(value.totalTokens),
    estimatedCostUsd: nonNegativeNumber(value.estimatedCostUsd),
    fallbackCount: nonNegativeNumber(value.fallbackCount),
  };
}

function nonNegativeNumber(value: unknown) { return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : 0; }

function readVersion(value: unknown): number {
  if (value === undefined) return 0;
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) throw new Error("Invalid storage version");
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
