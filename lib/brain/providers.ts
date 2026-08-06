import { decisionEngine, type DecisionEngineOptions } from "../decision-engine.ts";
import { PromptBuilder } from "./prompt-builder.ts";
import { parseBrainOutput } from "./schema.ts";
import type { Brain, BrainInput, BrainOutput, BrainProviderId, BrainStructuredOutput, BrainTrace, BrainValidation } from "./types.ts";

const promptBuilder = new PromptBuilder();

export class RuleBrainProvider implements Brain {
  readonly #options: DecisionEngineOptions;

  constructor(options: DecisionEngineOptions = {}) {
    this.#options = options;
  }

  async evaluate(input: BrainInput): Promise<BrainOutput> {
    return (await this.inspect(input)).parsedOutput;
  }

  async inspect(input: BrainInput): Promise<BrainTrace> {
    const started = performance.now();
    const decision = decisionEngine(input.context.yearlyGoal, input.context.todayAction, this.#options);
    return createTrace(input, decision, metadata("rules", performance.now() - started));
  }
}

type ApiResponse = { output: BrainOutput; prompt: string; rawResponse: string; validation: BrainValidation };

export class OpenAIBrainProvider implements Brain {
  readonly #fetch: typeof fetch;
  readonly #endpoint: string;

  constructor(fetchImpl: typeof fetch = fetch, endpoint = "/api/brain/decision") {
    this.#fetch = fetchImpl;
    this.#endpoint = endpoint;
  }

  async evaluate(input: BrainInput): Promise<BrainOutput> {
    return (await this.request(input)).output;
  }

  async inspect(input: BrainInput): Promise<BrainTrace> {
    const response = await this.request(input);
    return { context: input.context, prompt: response.prompt, rawResponse: response.rawResponse, parsedOutput: response.output, validation: response.validation };
  }

  private async request(input: BrainInput): Promise<ApiResponse> {
    try {
      const response = await this.#fetch(this.#endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!response.ok) throw new Error(`Brain request failed: ${response.status}`);
      return response.json() as Promise<ApiResponse>;
    } catch {
      const trace = await new RuleBrainProvider().inspect(input);
      const output = { ...trace.parsedOutput, metadata: { ...trace.parsedOutput.metadata, fallback: true, attempts: 0 } };
      return { output, prompt: trace.prompt, rawResponse: trace.rawResponse, validation: { status: "fallback", schema: false, reasoning: false, deliverable: false, message: "OpenAI is unavailable; Rules fallback used." } };
    }
  }
}

export class ClaudeBrainProvider implements Brain {
  async evaluate(input: BrainInput): Promise<BrainOutput> { return (await this.inspect(input)).parsedOutput; }
  async inspect(input: BrainInput): Promise<BrainTrace> { return createTrace(input, mockModelOutput("Claude", input), metadata("claude", 0)); }
}

export class GeminiBrainProvider implements Brain {
  async evaluate(input: BrainInput): Promise<BrainOutput> { return (await this.inspect(input)).parsedOutput; }
  async inspect(input: BrainInput): Promise<BrainTrace> { return createTrace(input, mockModelOutput("Gemini", input), metadata("gemini", 0)); }
}

function metadata(provider: BrainProviderId, latencyMs: number): BrainOutput["metadata"] {
  const model = provider === "rules" ? "Rule Engine" : `${provider[0].toUpperCase()}${provider.slice(1)} mock`;
  return { provider, model, latencyMs: Math.round(latencyMs), tokenUsage: null, fallback: false, attempts: 1, promptVersion: promptBuilder.version("decision"), estimatedCostUsd: 0 };
}

function createTrace(input: BrainInput, output: BrainStructuredOutput, outputMetadata: BrainOutput["metadata"]): BrainTrace {
  const rawResponse = JSON.stringify(output);
  return {
    context: input.context,
    prompt: promptBuilder.build(input.task, input.context),
    rawResponse,
    parsedOutput: { ...parseBrainOutput(rawResponse), metadata: outputMetadata },
    validation: { status: "passed", schema: true, reasoning: true, deliverable: true, message: "All validation checks passed." },
  };
}

function mockModelOutput(provider: string, input: BrainInput): BrainStructuredOutput {
  const action = input.context.todayAction.trim() || "当前行动";
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
