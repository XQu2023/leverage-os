export type DecisionRating = 1 | 2 | 3 | 4 | 5;
export type DecisionOutcomeResult = "success" | "partial-success" | "failed";

export type DecisionLesson = {
  why: string;
  correctAssumption: string;
  wrongAssumption: string;
  nextAdjustment: string;
};

export type DecisionQuality = {
  rating: DecisionRating;
  adopted: boolean;
  result: DecisionOutcomeResult;
  lesson: DecisionLesson;
};

export type LearningLoopContext = {
  recentFeedback: Array<{ date: string; decision: string; rating: DecisionRating; adopted: boolean }>;
  recentOutcomes: Array<{ date: string; decision: string; result: DecisionOutcomeResult }>;
  recentLessons: Array<{ date: string; decision: string; why: string; correctAssumption: string; wrongAssumption: string; nextAdjustment: string }>;
};

type QualitySourceEntry = {
  date?: string;
  chosenAction?: string;
  quality?: DecisionQuality | null;
};

export function outcomeFromCompletion(status: "completed" | "partial" | "failed"): DecisionOutcomeResult {
  if (status === "completed") return "success";
  if (status === "partial") return "partial-success";
  return "failed";
}

export function outcomeLabel(result: DecisionOutcomeResult) {
  if (result === "success") return "Success";
  if (result === "partial-success") return "Partial Success";
  return "Failed";
}

export function generateDecisionLesson(input: {
  action: string;
  result: DecisionOutcomeResult;
  adopted: boolean;
  rating: number;
  prediction?: string;
  wrongAssumption: string;
  nextTimeChange: string;
  biggestWaste: string;
  risk?: string;
}): DecisionLesson {
  const action = input.action.trim() || "今日决策";
  const waste = input.biggestWaste.trim() || input.risk?.trim() || "完成标准未被验证";
  const wrong = input.wrongAssumption.trim() || "关键假设未被明确检验";
  const next = input.nextTimeChange.trim() || "把行动收窄为一个可在当天验证的交付物";
  const prediction = input.prediction?.trim() || "原计划中的可验证结果";
  const adoptedText = input.adopted ? "采纳了 AI 建议" : "坚持了自己的计划";

  if (input.result === "success") {
    return {
      why: `行动“${action}”取得成功，因为交付被验证，且${adoptedText}后仍保持了足够窄的执行范围。`,
      correctAssumption: `“${prediction}”可以被当天完成并形成外部证据。`,
      wrongAssumption: wrong === "关键假设未被明确检验" ? "暂无明显错误假设；继续保留已验证的判断。" : `曾怀疑“${wrong}”，但结果证明它不是主要阻力。`,
      nextAdjustment: next,
    };
  }

  if (input.result === "partial-success") {
    return {
      why: `行动“${action}”只取得部分成功，主要因为“${waste}”阻断了完整交付。`,
      correctAssumption: `方向大体正确：${prediction} 仍值得继续推进。`,
      wrongAssumption: wrong,
      nextAdjustment: next,
    };
  }

  return {
    why: `行动“${action}”失败，因为“${waste}”阻止了计划结果，且评分仅 ${input.rating}/5。`,
    correctAssumption: input.adopted
      ? "AI 识别出的风险值得重视，但执行约束仍不够紧。"
      : "坚持原计划暴露了真实阻力，这本身是有价值的学习。",
    wrongAssumption: wrong,
    nextAdjustment: next,
  };
}

export function formatLessonSummary(lesson: DecisionLesson) {
  return `为什么：${lesson.why}\n正确假设：${lesson.correctAssumption}\n错误假设：${lesson.wrongAssumption}\n下次调整：${lesson.nextAdjustment}`;
}

export function extractLearningLoop(history: QualitySourceEntry[], limit = 20): LearningLoopContext {
  const entries = history.filter((entry): entry is QualitySourceEntry & { quality: DecisionQuality } => Boolean(entry.quality));
  const recent = entries.slice(0, limit);

  return {
    recentFeedback: recent.map((entry) => ({
      date: entry.date ?? "",
      decision: entry.chosenAction ?? "",
      rating: entry.quality.rating,
      adopted: entry.quality.adopted,
    })),
    recentOutcomes: recent.map((entry) => ({
      date: entry.date ?? "",
      decision: entry.chosenAction ?? "",
      result: entry.quality.result,
    })),
    recentLessons: recent.map((entry) => ({
      date: entry.date ?? "",
      decision: entry.chosenAction ?? "",
      why: entry.quality.lesson.why,
      correctAssumption: entry.quality.lesson.correctAssumption,
      wrongAssumption: entry.quality.lesson.wrongAssumption,
      nextAdjustment: entry.quality.lesson.nextAdjustment,
    })),
  };
}

export function normalizeDecisionQuality(value: unknown): DecisionQuality | null {
  if (!isRecord(value)) return null;
  const rating = value.rating;
  if (rating !== 1 && rating !== 2 && rating !== 3 && rating !== 4 && rating !== 5) return null;
  if (typeof value.adopted !== "boolean") return null;
  if (value.result !== "success" && value.result !== "partial-success" && value.result !== "failed") return null;
  const lesson = isRecord(value.lesson) ? value.lesson : {};
  return {
    rating,
    adopted: value.adopted,
    result: value.result,
    lesson: {
      why: asString(lesson.why),
      correctAssumption: asString(lesson.correctAssumption),
      wrongAssumption: asString(lesson.wrongAssumption),
      nextAdjustment: asString(lesson.nextAdjustment),
    },
  };
}

function asString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
