export type DecisionResult = {
  score: number;
  verdict: string;
  whyToday: string;
  biggestRisk: string;
  higherLeverageAlternative: string | null;
  todayDeliverable: string;
};

export function decisionEngine(goal: string, action: string): DecisionResult {
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
  const score = Math.max(35, Math.min(96, 58 + (concrete ? 19 : 7) + (aligned ? 13 : 5) - (vague ? 12 : 0)));

  if (customerFacing) {
    return {
      score,
      verdict: score >= 78 ? "高杠杆行动" : "方向正确，需要收窄",
      whyToday: "它能在今天获得真实客户信号，直接减少后续判断中的猜测。",
      biggestRisk: "对话没有明确问题和记录方式，最后只留下零散印象。",
      higherLeverageAlternative: vague ? "完成 3 次目标客户访谈，并把共同问题整理成一页洞察" : null,
      todayDeliverable: "一页客户洞察：3 个原话、1 个共同问题、1 个下一步决定。",
    };
  }

  if (content) {
    return {
      score,
      verdict: score >= 78 ? "高杠杆行动" : "方向正确，需要收窄",
      whyToday: "发布会把内部思考变成外部反馈，并为后续内容积累可复用素材。",
      biggestRisk: "把时间耗在打磨细节上，最终没有真正发布并获得反馈。",
      higherLeverageAlternative: vague ? "发布一个最小版本，并向 5 位目标读者收集反馈" : null,
      todayDeliverable: "一个已公开发布的内容链接，以及首轮反馈记录。",
    };
  }

  if (product) {
    return {
      score,
      verdict: score >= 78 ? "高杠杆行动" : "方向正确，需要收窄",
      whyToday: "它能把产品假设变成可测试的结果，让下一步由真实使用反馈驱动。",
      biggestRisk: "范围继续扩大，今天结束时仍没有可供用户验证的版本。",
      higherLeverageAlternative: vague ? "交付一个只验证核心假设的最小版本，并让 1 位用户试用" : null,
      todayDeliverable: "一个可演示的最小版本，以及 1 条真实用户反馈。",
    };
  }

  return {
    score,
    verdict: score >= 78 ? "高杠杆行动" : score >= 65 ? "方向正确，需要收窄" : "先让行动更具体",
    whyToday: concrete
      ? "它会在今天产生可验证的外部结果，而不只是增加内部准备。"
      : "它与年度目标相关；把它收窄为今日交付物后，推进价值会更明确。",
    biggestRisk: vague
      ? "行动停留在研究或规划，没有形成可以验证进展的结果。"
      : "完成标准不够明确，容易在低价值细节上投入过多时间。",
    higherLeverageAlternative: vague ? `把“${normalizedAction}”改成一个今天可交付、可被他人验证的最小成果` : null,
    todayDeliverable: "一个可分享的成果链接或一页总结，包含结果、证据和下一步。",
  };
}
