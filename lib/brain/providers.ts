import { decisionEngine, type DecisionEngineOptions } from "../decision-engine.ts";
import type { Brain, BrainInput, BrainOutput } from "./types.ts";

export class RuleBrainProvider implements Brain {
  readonly #options: DecisionEngineOptions;

  constructor(options: DecisionEngineOptions = {}) {
    this.#options = options;
  }

  async evaluate(input: BrainInput): Promise<BrainOutput> {
    return decisionEngine(input.goal, input.action, this.#options);
  }
}

export class OpenAIBrainProvider implements Brain {
  async evaluate(input: BrainInput): Promise<BrainOutput> {
    return mockModelResponse("OpenAI", input);
  }
}

export class ClaudeBrainProvider implements Brain {
  async evaluate(input: BrainInput): Promise<BrainOutput> {
    return mockModelResponse("Claude", input);
  }
}

export class GeminiBrainProvider implements Brain {
  async evaluate(input: BrainInput): Promise<BrainOutput> {
    return mockModelResponse("Gemini", input);
  }
}

function mockModelResponse(provider: string, input: BrainInput): BrainOutput {
  const action = input.action.trim() || "当前行动";
  return {
    outcome: "Refine",
    score: 72,
    verdict: "Refine",
    recommendation: `把“${action}”收窄为一个今天可验证的交付物`,
    whyToday: `${provider} mock：这个行动与年度目标有关，但应先明确今天的验证结果。`,
    biggestRisk: "当前为 mock 判断；主要风险是完成标准不够具体。",
    higherLeverageAlternative: `交付“${action}”的最小可验证版本`,
    todayDeliverable: "一个可分享的结果，以及一条外部反馈。",
    reasoning: {
      score: [`${provider} mock 基础分 72`, "尚未调用外部模型 API"],
      risk: "Mock provider 使用固定风险模板，等待未来模型接入。",
      recommendation: `通过统一 Brain 接口返回 ${provider} mock 建议。`,
    },
  };
}
