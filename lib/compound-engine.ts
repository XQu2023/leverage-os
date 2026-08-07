export type CompoundProposal = {
  asset: string;
  why: string;
  nextStep: string;
  futureValue: 1 | 2 | 3 | 4 | 5;
};

export function suggestCompound(action: string): CompoundProposal {
  const text = action.trim() || "今日行动";

  if (/客户|销售|联系|访谈|用户/.test(text)) {
    return {
      asset: "客户洞察模板",
      why: "一次真实对话里的模式，可以反复用来判断下一位客户。",
      nextStep: "把今天听到的原话、问题和假设写进模板。",
      futureValue: 5,
    };
  }

  if (/内容|发布|文章|视频|写/.test(text)) {
    return {
      asset: "可复用内容发布流程",
      why: "固定流程能把每次发布变成可迭代的系统，而不是一次性输出。",
      nextStep: "记录今天的选题、结构与发布步骤，形成最小流程。",
      futureValue: 4,
    };
  }

  if (/产品|开发|功能|上线|测试/.test(text)) {
    return {
      asset: "最小交付与反馈模板",
      why: "把交付标准和反馈问题固化，下次上线不用重新摸索。",
      nextStep: "写下今天的完成标准，并收集 3 条真实反馈。",
      futureValue: 5,
    };
  }

  return {
    asset: `${text} · 复用模板`,
    why: "把一次性努力提炼成模板，下次可以直接调用，而不是重做。",
    nextStep: "用 5 分钟把步骤、判断标准与结果证据写下来。",
    futureValue: 3,
  };
}

export function formatFutureValue(value: number) {
  const stars = Math.min(5, Math.max(1, Math.round(value)));
  return "★".repeat(stars) + "☆".repeat(5 - stars);
}
