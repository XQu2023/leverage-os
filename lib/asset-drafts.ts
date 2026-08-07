export type AssetDraftType = "SOP" | "Prompt" | "Template" | "Knowledge Base";

export type AssetDraft = {
  id: string;
  type: AssetDraftType;
  title: string;
  content: string;
  status: "draft" | "saved";
};

export function generateAssetDrafts(goal: string, action: string, compoundAsset = ""): AssetDraft[] {
  const safeGoal = goal.trim() || "当前年度目标";
  const safeAction = action.trim() || "今日最高杠杆行动";
  const focus = compoundAsset.trim() || safeAction;

  return [
    {
      id: "sop",
      type: "SOP",
      title: `${focus} · 执行 SOP`,
      content: `目标：${safeGoal}\n资产焦点：${focus}\n\n1. 明确今天的完成标准。\n2. 执行：${safeAction}\n3. 保存结果与证据。\n4. 记录反馈并确定下一步。`,
      status: "draft",
    },
    {
      id: "prompt",
      type: "Prompt",
      title: `${focus} · 复用 Prompt`,
      content: `你是我的执行教练。年度目标是“${safeGoal}”。今天要完成“${safeAction}”，并沉淀为“${focus}”。请帮我把行动拆成最少步骤，明确可验证交付物，并指出最可能阻碍完成的一个风险。`,
      status: "draft",
    },
    {
      id: "template",
      type: "Template",
      title: `${focus} · Template`,
      content: `模板名称：${focus}\n适用场景：\n输入：\n步骤：\n1.\n2.\n3.\n输出：\n复用条件：当目标是“${safeGoal}”且行动类似“${safeAction}”时使用。`,
      status: "draft",
    },
    {
      id: "knowledge-base",
      type: "Knowledge Base",
      title: `${focus} · Knowledge Base`,
      content: `主题：${focus}\n来源行动：${safeAction}\n关联目标：${safeGoal}\n\n关键事实：\n已验证假设：\n仍开放的问题：\n下次可直接调用的结论：`,
      status: "draft",
    },
  ];
}
