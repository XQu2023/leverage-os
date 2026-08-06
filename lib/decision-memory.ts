export type DecisionChoice = "follow-ai" | "keep-plan";

export type DecisionHistoryEntry = {
  id: string;
  date: string;
  yearlyGoal: string;
  chosenAction: string;
  aiRecommendation: string;
  userChoice: DecisionChoice;
  outcome: "Execute" | "Refine" | "Reject Today";
  completionStatus: "pending" | "completed" | "partial" | "failed";
  score: number;
  risk: string;
  biggestWaste: string;
  aiExplanation?: string;
  tomorrowRecommendation?: string;
};

export type WeeklyDecisionReport = {
  total: number;
  followAiRate: number;
  keepMyPlanRate: number;
  highestLeverageDecisions: DecisionHistoryEntry[];
  mostCommonWaste: string;
  repeatedRisks: string[];
  completionRate: number;
  aiAdoptionRate: number;
  decisionAccuracy: number;
  highestLeverageWins: DecisionHistoryEntry[];
  repeatedFailures: string[];
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
  const completedCount = recent.filter((entry) => entry.completionStatus === "completed").length;
  const wastes = countValues(recent.map((entry) => entry.biggestWaste).filter(Boolean));
  const risks = countValues(recent.map((entry) => entry.risk).filter(Boolean));
  const repeatedRisks = [...risks.entries()]
    .filter(([, count]) => count > 1)
    .sort((a, b) => b[1] - a[1])
    .map(([risk]) => risk);
  const mostCommonWaste = [...wastes.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "暂无足够回顾数据";
  const highestLeverageDecisions = [...recent].sort((a, b) => b.score - a.score).slice(0, 3);
  const highestLeverageWins = recent
    .filter((entry) => entry.completionStatus === "completed")
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
  const failed = recent.filter((entry) => entry.completionStatus === "partial" || entry.completionStatus === "failed");
  const failureCounts = countValues(failed.map((entry) => entry.biggestWaste || entry.risk).filter(Boolean));
  const repeatedFailures = [...failureCounts.entries()]
    .filter(([, count]) => count > 1)
    .sort((a, b) => b[1] - a[1])
    .map(([failure]) => failure);
  const accurateCount = recent.filter((entry) => {
    const outcome = entry.outcome ?? "Refine";
    if (outcome === "Execute") return entry.completionStatus === "completed";
    if (outcome === "Refine") return entry.completionStatus === "completed" || entry.completionStatus === "partial";
    return entry.userChoice === "follow-ai" || entry.completionStatus === "failed";
  }).length;
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
    completionRate: total ? Math.round((completedCount / total) * 100) : 0,
    aiAdoptionRate: followRate,
    decisionAccuracy: total ? Math.round((accurateCount / total) * 100) : 0,
    highestLeverageWins,
    repeatedFailures,
    recommendation,
  };
}

export function explainIncompleteDecision(
  status: "partial" | "failed",
  action: string,
  biggestWaste: string,
  risk: string,
): { explanation: string; tomorrowRecommendation: string } {
  const blocker = biggestWaste.trim() || risk;
  return status === "partial"
    ? {
        explanation: `行动“${action}”取得了部分进展，但“${blocker}”阻止了完整交付。`,
        tomorrowRecommendation: "保留已经完成的部分，把剩余工作收窄为一个可在 60 分钟内验证的交付物。",
      }
    : {
        explanation: `行动“${action}”没有形成计划中的可验证结果，主要阻力是“${blocker}”。`,
        tomorrowRecommendation: "不要原样重试。先移除主要阻力，再选择一个更小、能产生外部证据的行动。",
      };
}

function countValues(values: string[]): Map<string, number> {
  return values.reduce((counts, value) => counts.set(value, (counts.get(value) ?? 0) + 1), new Map<string, number>());
}
