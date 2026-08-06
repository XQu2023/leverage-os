export const DEFAULT_REJECTION_THRESHOLD = 60;

export type DecisionReasoning = {
  score: string[];
  risk: string;
  recommendation: string;
};

export type DecisionResult = {
  score: number;
  verdict: string;
  recommendation: string;
  whyToday: string;
  biggestRisk: string;
  higherLeverageAlternative: string | null;
  todayDeliverable: string;
  reasoning: DecisionReasoning;
};

export type DecisionEngineOptions = {
  rejectionThreshold?: number;
};

export function decisionEngine(
  goal: string,
  action: string,
  options: DecisionEngineOptions = {},
): DecisionResult {
  const rejectionThreshold = options.rejectionThreshold ?? DEFAULT_REJECTION_THRESHOLD;
  const normalizedAction = action.trim();
  const text = normalizedAction.toLowerCase();
  const concrete = /发布|完成|联系|访谈|销售|交付|测试|签约|上线|launch|ship|call|sell|publish|deliver|test/.test(text);
  const vague = /研究|看看|学习|整理|想想|规划|research|learn|explore|plan/.test(text);
  const customerFacing = /客户|销售|联系|访谈|用户|customer|sales|interview|user/.test(text);
  const content = /内容|发布|文章|视频|写|content|publish|article|video|write/.test(text);
  const product = /产品|开发|功能|上线|测试|product|develop|feature|launch|test/.test(text);
  const aligned = goal
    .split(/[，。,.;；\s]/)
    .filter((word) => word.length > 1)
    .some((word) => normalizedAction.includes(word));
  const scoreParts = [
    "基础分 58",
    concrete ? "行动可产生外部结果 +19" : "行动具体性有限 +7",
    aligned ? "与年度目标存在关键词对齐 +13" : "与年度目标缺少直接对齐 +5",
    ...(vague ? ["包含研究或规划型表达 -12"] : []),
  ];
  const score = Math.max(35, Math.min(96, 58 + (concrete ? 19 : 7) + (aligned ? 13 : 5) - (vague ? 12 : 0)));

  let whyToday: string;
  let biggestRisk: string;
  let higherLeverageAlternative: string | null;
  let todayDeliverable: string;
  let riskReason: string;

  if (customerFacing) {
    whyToday = "它能在今天获得真实客户信号，直接减少后续判断中的猜测。";
    biggestRisk = "对话没有明确问题和记录方式，最后只留下零散印象。";
    higherLeverageAlternative = vague ? "完成 3 次目标客户访谈，并把共同问题整理成一页洞察" : null;
    todayDeliverable = "一页客户洞察：3 个原话、1 个共同问题、1 个下一步决定。";
    riskReason = "检测到客户或访谈语义；这类行动的主要失败模式是有对话、无结构化证据。";
  } else if (content) {
    whyToday = "发布会把内部思考变成外部反馈，并为后续内容积累可复用素材。";
    biggestRisk = "把时间耗在打磨细节上，最终没有真正发布并获得反馈。";
    higherLeverageAlternative = vague ? "发布一个最小版本，并向 5 位目标读者收集反馈" : null;
    todayDeliverable = "一个已公开发布的内容链接，以及首轮反馈记录。";
    riskReason = "检测到内容或发布语义；这类行动最常见的风险是过度打磨而没有发布。";
  } else if (product) {
    whyToday = "它能把产品假设变成可测试的结果，让下一步由真实使用反馈驱动。";
    biggestRisk = "范围继续扩大，今天结束时仍没有可供用户验证的版本。";
    higherLeverageAlternative = vague ? "交付一个只验证核心假设的最小版本，并让 1 位用户试用" : null;
    todayDeliverable = "一个可演示的最小版本，以及 1 条真实用户反馈。";
    riskReason = "检测到产品或开发语义；这类行动的主要风险是范围扩张导致无法当天验证。";
  } else {
    whyToday = concrete
      ? "它会在今天产生可验证的外部结果，而不只是增加内部准备。"
      : "它与年度目标相关；把它收窄为今日交付物后，推进价值会更明确。";
    biggestRisk = vague
      ? "行动停留在研究或规划，没有形成可以验证进展的结果。"
      : "完成标准不够明确，容易在低价值细节上投入过多时间。";
    higherLeverageAlternative = vague ? `把“${normalizedAction}”改成一个今天可交付、可被他人验证的最小成果` : null;
    todayDeliverable = "一个可分享的成果链接或一页总结，包含结果、证据和下一步。";
    riskReason = vague
      ? "检测到研究或规划型表达，但没有检测到明确的外部交付动作。"
      : "未检测到清晰的完成标准，因此将执行边界视为首要风险。";
  }

  const rejected = score < rejectionThreshold;
  const recommendation = rejected
    ? "Do not do this today"
    : higherLeverageAlternative ?? normalizedAction;
  const verdict = rejected
    ? "Do not do this today"
    : score >= 78
      ? "高杠杆行动"
      : "方向正确，需要收窄";

  return {
    score,
    verdict,
    recommendation,
    whyToday: rejected
      ? `当前得分 ${score}，低于 ${rejectionThreshold} 分阈值。先改写为可在今天验证的行动。`
      : whyToday,
    biggestRisk,
    higherLeverageAlternative,
    todayDeliverable,
    reasoning: {
      score: [...scoreParts, `最终得分 ${score}（限制在 35–96）`],
      risk: riskReason,
      recommendation: rejected
        ? `得分 ${score} 低于可配置阈值 ${rejectionThreshold}，因此明确建议今天不做。`
        : higherLeverageAlternative
          ? "检测到模糊表达且存在更具体的同类行动，因此推荐更高杠杆替代方案。"
          : "行动已足够具体，未发现更高杠杆的确定性替代方案，因此建议保持当前计划。",
    },
  };
}
