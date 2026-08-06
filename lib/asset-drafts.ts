export type AssetDraftType = "SOP" | "Prompt" | "Customer Insight" | "Decision Principle";

export type AssetDraft = {
  id: string;
  type: AssetDraftType;
  title: string;
  content: string;
  status: "draft" | "saved";
};

export function generateAssetDrafts(goal: string, action: string): AssetDraft[] {
  const safeGoal = goal.trim() || "当前年度目标";
  const safeAction = action.trim() || "今日最高杠杆行动";
  return [
    {
      id: "sop",
      type: "SOP",
      title: `${safeAction} · 执行 SOP`,
      content: `目标：${safeGoal}\n\n1. 明确今天的完成标准。\n2. 执行：${safeAction}\n3. 保存结果与证据。\n4. 记录反馈并确定下一步。`,
      status: "draft",
    },
    {
      id: "prompt",
      type: "Prompt",
      title: `${safeAction} · 复用 Prompt`,
      content: `你是我的执行教练。年度目标是“${safeGoal}”。今天要完成“${safeAction}”。请帮我把行动拆成最少步骤，明确可验证交付物，并指出最可能阻碍完成的一个风险。`,
      status: "draft",
    },
    {
      id: "customer-insight",
      type: "Customer Insight",
      title: `${safeAction} · 客户洞察`,
      content: `观察：\n客户原话：\n真正的问题：\n现有替代方案：\n可验证假设：${safeAction} 是否能更直接地推进“${safeGoal}”？\n下一步实验：`,
      status: "draft",
    },
    {
      id: "decision-principle",
      type: "Decision Principle",
      title: `${safeAction} · 决策原则`,
      content: `当目标是“${safeGoal}”时，优先选择能在当天产生外部证据的行动。\n\n本次行动：${safeAction}\n采用条件：\n拒绝条件：\n今天的证据：\n下次可复用的判断：`,
      status: "draft",
    },
  ];
}
