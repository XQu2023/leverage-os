export type OneBet = {
  action: string;
  successProbability: number;
  expectedReturn: 1 | 2 | 3 | 4 | 5;
  feedbackCycle: string;
  whyOnly: string;
};

export const ONE_BET_ACTION_MAX = 30;

export function emptyOneBet(): OneBet {
  return {
    action: "",
    successProbability: 0,
    expectedReturn: 3,
    feedbackCycle: "",
    whyOnly: "",
  };
}

export function clipBetAction(text: string, max = ONE_BET_ACTION_MAX) {
  return Array.from(text).slice(0, max).join("");
}

export function formatExpectedReturn(value: number) {
  const stars = Math.min(5, Math.max(1, Math.round(value)));
  return "★".repeat(stars) + "☆".repeat(5 - stars);
}

export function normalizeOneBet(value: unknown, action = ""): OneBet {
  const source = isRecord(value) ? value : {};
  const expectedReturn = ([1, 2, 3, 4, 5] as const).includes(source.expectedReturn as 1 | 2 | 3 | 4 | 5)
    ? source.expectedReturn as 1 | 2 | 3 | 4 | 5
    : 3;
  const probability = typeof source.successProbability === "number" && Number.isFinite(source.successProbability)
    ? Math.min(100, Math.max(0, Math.round(source.successProbability)))
    : 0;
  return {
    action: clipBetAction(typeof source.action === "string" ? source.action : action),
    successProbability: probability,
    expectedReturn,
    feedbackCycle: typeof source.feedbackCycle === "string" ? source.feedbackCycle : "",
    whyOnly: typeof source.whyOnly === "string" ? source.whyOnly : "",
  };
}

export function suggestOneBet(goal: string, action = ""): OneBet {
  const goalText = goal.trim() || "年度目标";
  const text = clipBetAction(action.trim());

  if (/客户|销售|联系|访谈|用户|英国/.test(text) || /客户|销售/.test(goalText)) {
    return {
      action: text || "联系20家客户验证真实需求",
      successProbability: 72,
      expectedReturn: 5,
      feedbackCycle: "今天至 48 小时内",
      whyOnly: "只有真实客户反馈能降低最大不确定性；其它准备、优化和内部讨论都不能今天被验证，所以今天只押这一注。",
    };
  }

  if (/内容|发布|文章|视频|写/.test(text) || /内容|品牌/.test(goalText)) {
    return {
      action: text || "发布最小内容并收集反馈",
      successProbability: 68,
      expectedReturn: 4,
      feedbackCycle: "24 小时内",
      whyOnly: "内容只有发布后才产生证据；打磨文案或规划选题都无法今天验证，所以放弃其它事项，只做这一次可回收反馈的发布。",
    };
  }

  if (/产品|开发|功能|上线|测试/.test(text) || /产品|MRR|收入/.test(goalText)) {
    return {
      action: text || "上线最小版本并收集反馈",
      successProbability: 65,
      expectedReturn: 5,
      feedbackCycle: "今天至 72 小时内",
      whyOnly: "最小可验证交付比继续规划和扩功能更能推动目标；今天其它任务都应让路给这一次外部证据。",
    };
  }

  return {
    action: text || "完成一个可验证的今日交付",
    successProbability: 60,
    expectedReturn: 3,
    feedbackCycle: "今天结束前",
    whyOnly: `这是最直接推进“${goalText}”且今天能得到验证的一注；其它事情要么不可验证，要么不能今天改变结果，因此全部延后。`,
  };
}

export function ensureOneBet(goal: string, action: string, current?: Partial<OneBet> | null): OneBet {
  const suggested = suggestOneBet(goal, action || current?.action || "");
  const normalized = normalizeOneBet(current, action || current?.action || "");
  if (!normalized.action.trim()) return suggested;
  return {
    action: normalized.action,
    successProbability: normalized.successProbability > 0 ? normalized.successProbability : suggested.successProbability,
    expectedReturn: normalized.expectedReturn,
    feedbackCycle: normalized.feedbackCycle.trim() || suggested.feedbackCycle,
    whyOnly: normalized.whyOnly.trim() || suggested.whyOnly,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
