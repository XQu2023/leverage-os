export type DecisionChoice = "follow-ai" | "keep-plan";

export type DecisionHistoryEntry = {
  id: string;
  date: string;
  yearlyGoal: string;
  chosenAction: string;
  aiRecommendation: string;
  userChoice: DecisionChoice;
  completionStatus: "pending" | "completed";
  score: number;
  risk: string;
  biggestWaste: string;
};

export type WeeklyDecisionReport = {
  total: number;
  followAiRate: number;
  keepMyPlanRate: number;
  highestLeverageDecisions: DecisionHistoryEntry[];
  mostCommonWaste: string;
  repeatedRisks: string[];
  recommendation: string;
};

export function generateWeeklyDecisionReport(
  history: DecisionHistoryEntry[],
  now = new Date(),
): WeeklyDecisionReport {
  const weekStart = new Date(now);
  weekStart.setDate(weekStart.getDate() - 6);
  weekStart.setHours(0, 0, 0, 0);
  const recent = history.filter((entry) => {
    const date = new Date(entry.date);
    return !Number.isNaN(date.getTime()) && date >= weekStart && date <= now;
  });
  const total = recent.length;
  const followCount = recent.filter((entry) => entry.userChoice === "follow-ai").length;
  const wastes = countValues(recent.map((entry) => entry.biggestWaste).filter(Boolean));
  const risks = countValues(recent.map((entry) => entry.risk).filter(Boolean));
  const repeatedRisks = [...risks.entries()]
    .filter(([, count]) => count > 1)
    .sort((a, b) => b[1] - a[1])
    .map(([risk]) => risk);
  const mostCommonWaste = [...wastes.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "暂无足够回顾数据";
  const highestLeverageDecisions = [...recent].sort((a, b) => b.score - a.score).slice(0, 3);
  const keepRate = total ? Math.round(((total - followCount) / total) * 100) : 0;
  const followRate = total ? 100 - keepRate : 0;

  let recommendation = "下周先记录至少一次完整决策和日回顾，建立可分析的基线。";
  if (total) {
    if (repeatedRisks.length) recommendation = `下周优先设计一个检查点，主动消除反复出现的风险：${repeatedRisks[0]}`;
    else if (followRate < 50) recommendation = "下周选择一次低成本决策采纳 AI 建议，并比较实际结果。";
    else if (recent.some((entry) => entry.completionStatus === "pending")) recommendation = "下周减少同时推进的决定，先完成仍处于待完成状态的行动。";
    else recommendation = "继续保持决策—执行—回顾闭环，并提高每日交付物的可验证性。";
  }

  return {
    total,
    followAiRate: followRate,
    keepMyPlanRate: keepRate,
    highestLeverageDecisions,
    mostCommonWaste,
    repeatedRisks,
    recommendation,
  };
}

function countValues(values: string[]): Map<string, number> {
  return values.reduce((counts, value) => counts.set(value, (counts.get(value) ?? 0) + 1), new Map<string, number>());
}
