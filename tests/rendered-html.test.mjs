import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { decisionEngine } from "../lib/decision-engine.ts";
import { generateAssetDrafts } from "../lib/asset-drafts.ts";
import { explainIncompleteDecision, generateWeeklyDecisionReport } from "../lib/decision-memory.ts";
import { LATEST_STORAGE_VERSION, STORAGE_BACKUP_PREFIX, STORAGE_KEY, loadStoredState, migrateStoredState } from "../lib/storage.ts";
import { BRAIN_OPTIONS, ContextBuilder, OpenAIBrainProvider, PROMPT_VERSIONS, PromptBuilder, RuleBrainProvider, createBrain, parseBrainOutput } from "../lib/brain/index.ts";
import { evaluateOpenAIDecision } from "../lib/brain/openai-server.ts";

async function render() {
  const html = await readFile(
    new URL("../.next/server/app/index.html", import.meta.url),
    "utf8",
  );

  return new Response(html, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

test("server-renders a deterministic Leverage OS shell", async () => {
  const [firstResponse, secondResponse] = await Promise.all([render(), render()]);
  assert.equal(firstResponse.status, 200);
  assert.equal(secondResponse.status, 200);

  const [firstHtml, secondHtml] = await Promise.all([
    firstResponse.text(),
    secondResponse.text(),
  ]);

  assert.equal(firstHtml, secondHtml);
  assert.match(firstHtml, /<title>Leverage OS — 每天只做最高杠杆的事<\/title>/);
  assert.match(firstHtml, /<h1>今天<\/h1>/);
  assert.match(firstHtml, /01 · ONE-YEAR GOAL/);
  assert.doesNotMatch(firstHtml, /<h1>\d{1,2}月\d{1,2}日/);
});

test("keeps device-dependent values out of the initial render", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");

  assert.match(page, /const today = hydrated\s*\?/);
  assert.match(page, /:\s*["']今天["'];/);
  assert.match(page, /useEffect\(\(\) => \{[\s\S]*loadStoredState\(window\.localStorage/);
  assert.doesNotMatch(page, /useState\([^\n]*(?:new Date|Date\.now|Math\.random|toLocale)/);
});

test("implements Leave Behind with editable AI asset drafts", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const drafts = generateAssetDrafts("获得 100 位客户", "完成 3 次客户访谈");

  assert.match(page, /05 · LEAVE BEHIND/);
  assert.deepEqual(drafts.map((draft) => draft.type), ["SOP", "Prompt", "Customer Insight", "Decision Principle"]);
  assert.ok(drafts.every((draft) => draft.content.includes("完成 3 次客户访谈")));
  assert.match(page, /Preview/);
  assert.match(page, /Edit/);
  assert.match(page, /Saved ✓/);
  assert.match(page, /保存资产并继续/);
});

test("implements Daily Review with all three saved prompts", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");

  assert.match(page, /Biggest Waste/);
  assert.match(page, /Best Asset Created/);
  assert.match(page, /Tomorrow&apos;s One Focus/);
  assert.match(page, /biggestWaste: data\.biggestWaste/);
  assert.match(page, /bestAsset: data\.bestAsset/);
  assert.match(page, /tomorrowFocus: data\.tomorrowFocus/);
  assert.match(page, /Completed/);
  assert.match(page, /Partial/);
  assert.match(page, /Failed/);
});

test("links sidebar summaries to accessible asset and review libraries", async () => {
  const [page, css] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(page, /onClick=\{openAssets\}/);
  assert.match(page, /onClick=\{openReviews\}/);
  assert.match(page, /查看留下的资产，共/);
  assert.match(page, /查看完成的日回顾，共/);
  assert.match(page, /ASSET LIBRARY/);
  assert.match(page, /REVIEW LIBRARY/);
  assert.match(page, /function ReviewDetail/);
  assert.match(css, /\.system-stat:hover/);
  assert.match(css, /\.system-stat:focus-visible/);
  assert.match(css, /\.library-row:focus-visible/);
});

test("generates deterministic decision guidance behind a replaceable interface", () => {
  const first = decisionEngine("一年内获得 100 位客户", "研究客户需求");
  const second = decisionEngine("一年内获得 100 位客户", "研究客户需求");

  assert.deepEqual(first, second);
  assert.ok(first.whyToday);
  assert.ok(first.biggestRisk);
  assert.ok(first.higherLeverageAlternative);
  assert.ok(first.todayDeliverable);
});

test("keeps the two decision paths and local choice in the page state", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");

  assert.match(page, /brain\.evaluate\(brainInput\)/);
  assert.doesNotMatch(page, /decisionEngine/);
  assert.match(page, /Follow AI/);
  assert.match(page, /Keep My Plan/);
  assert.match(page, /aiChoice: choice/);
  assert.match(page, /higherLeverageAlternative/);
  assert.doesNotMatch(page, /接受判断，继续/);
});

test("evaluates every provider through the same Brain interface", async () => {
  assert.deepEqual(BRAIN_OPTIONS.map((option) => option.label), ["Rules", "OpenAI", "Claude", "Gemini"]);
  for (const option of BRAIN_OPTIONS) {
    const brain = option.id === "openai"
      ? new OpenAIBrainProvider(async () => Response.json(makeApiEvaluation("openai")), "https://example.test/brain")
      : createBrain(option.id);
    const output = await brain.evaluate(makeBrainInput(option.id));
    assert.ok(["Execute", "Refine", "Reject Today"].includes(output.outcome));
    assert.equal(typeof output.score, "number");
    assert.ok(output.reasoning.score.length);
    assert.ok(output.biggestRisk);
  }
});

test("keeps rules deterministic and routes OpenAI through the server endpoint", async () => {
  const input = makeBrainInput("rules", "发布产品", "完成用户测试");
  const rules = new RuleBrainProvider();
  assert.deepEqual(await rules.evaluate(input), await rules.evaluate(input));

  let requestedUrl = "";
  const openai = await new OpenAIBrainProvider(async (url) => {
    requestedUrl = String(url);
    return Response.json(makeApiEvaluation("openai"));
  }, "https://example.test/api/brain/decision").evaluate(makeBrainInput("openai", "发布产品", "完成用户测试"));
  assert.equal(requestedUrl, "https://example.test/api/brain/decision");
  assert.equal(openai.metadata.provider, "openai");
});

test("builds bounded provider context from goals, decisions, assets, and reviews", () => {
  const context = new ContextBuilder(2).build({
    yearlyGoal: " 100 位客户 ", todayAction: " 完成访谈 ", selectedProvider: "openai",
    decisionHistory: [{ id: 1 }, { id: 2 }, { id: 3 }],
    assets: [{ id: "a" }, { id: "b" }, { id: "c" }],
    reviews: [{ id: "r1" }],
  });
  assert.equal(context.yearlyGoal, "100 位客户");
  assert.equal(context.todayAction, "完成访谈");
  assert.equal(context.recentDecisionHistory.length, 2);
  assert.equal(context.recentAssets.length, 2);
  assert.equal(context.recentReviews.length, 1);
  assert.equal(context.selectedProvider, "openai");
});

test("keeps separate prompt templates for all four Brain tasks", () => {
  const builder = new PromptBuilder();
  const context = makeBrainInput("rules").context;
  for (const task of ["decision", "multiplier", "asset", "review"]) {
    const prompt = builder.build(task, context);
    assert.match(prompt, new RegExp(`TASK: ${task.toUpperCase()}`));
    assert.match(prompt, /Return JSON only/);
    assert.match(prompt, new RegExp(`PROMPT_VERSION: ${PROMPT_VERSIONS[task]}`));
    assert.match(prompt, /yearlyGoal/);
  }
});

test("enforces one structured JSON output schema for provider responses", async () => {
  const trace = await createBrain("claude").inspect(makeBrainInput("claude"));
  const structuredOutput = { ...trace.parsedOutput };
  delete structuredOutput.metadata;
  assert.deepEqual(parseBrainOutput(trace.rawResponse), structuredOutput);
  assert.throws(() => parseBrainOutput('{"outcome":"Execute"}'), /missing required fields/);
  assert.throws(() => parseBrainOutput('{broken'), SyntaxError);
});

test("retries OpenAI once, validates the result, and records usage metadata", async () => {
  let calls = 0;
  const valid = makeStructuredOutput();
  const invalid = { ...valid, reasoning: { ...valid.reasoning, score: ["only one factor"] } };
  const result = await evaluateOpenAIDecision(makeBrainInput("openai"), {
    apiKey: "test-key",
    model: "test-model",
    now: (() => { let time = 100; return () => (time += 25); })(),
    fetchImpl: async (_url, init) => {
      calls += 1;
      const request = JSON.parse(init.body);
      assert.equal(request.text.format.strict, true);
      assert.equal(request.text.format.type, "json_schema");
      return Response.json({ output_text: JSON.stringify(calls === 1 ? invalid : valid), usage: { input_tokens: 10, output_tokens: 5, total_tokens: 15 } });
    },
  });
  assert.equal(calls, 2);
  assert.equal(result.output.metadata.provider, "openai");
  assert.equal(result.output.metadata.fallback, false);
  assert.equal(result.output.metadata.attempts, 2);
  assert.deepEqual(result.output.metadata.tokenUsage, { inputTokens: 20, outputTokens: 10, totalTokens: 30 });
});

test("falls back to rules after two invalid OpenAI evaluations", async () => {
  let calls = 0;
  const result = await evaluateOpenAIDecision(makeBrainInput("openai"), {
    apiKey: "test-key",
    fetchImpl: async () => {
      calls += 1;
      return Response.json({ output_text: '{"outcome":"Execute"}', usage: { input_tokens: 2, output_tokens: 1, total_tokens: 3 } });
    },
  });
  assert.equal(calls, 2);
  assert.equal(result.output.metadata.provider, "rules");
  assert.equal(result.output.metadata.fallback, true);
  assert.equal(result.output.metadata.attempts, 2);
  assert.deepEqual(result.output.metadata.tokenUsage, { inputTokens: 4, outputTokens: 2, totalTokens: 6 });
});

test("falls back without a network request when no API key is configured", async () => {
  let calls = 0;
  const result = await evaluateOpenAIDecision(makeBrainInput("openai"), {
    apiKey: "",
    fetchImpl: async () => { calls += 1; throw new Error("must not call"); },
  });
  assert.equal(calls, 0);
  assert.equal(result.output.metadata.provider, "rules");
  assert.equal(result.output.metadata.fallback, true);
  assert.equal(result.output.metadata.attempts, 0);
});

test("includes a development-only Prompt Playground trace without production markup", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const response = await render();
  const html = await response.text();
  assert.match(page, /process\.env\.NODE_ENV !== "production"/);
  assert.match(page, /Generated Context/);
  assert.match(page, /Generated Prompt/);
  assert.match(page, /Raw Provider Response/);
  assert.match(page, /Parsed Output/);
  assert.doesNotMatch(html, /Prompt Playground/);
});

test("explains its reasoning and explicitly rejects scores below a configurable threshold", () => {
  const decision = decisionEngine("建立一家成功的公司", "研究和规划", { rejectionThreshold: 70 });

  assert.equal(decision.outcome, "Reject Today");
  assert.equal(decision.verdict, "Reject Today");
  assert.equal(decision.recommendation, "Do not do this today");
  assert.match(decision.reasoning.recommendation, /低于可配置阈值 70/);
  assert.ok(decision.reasoning.score.length >= 4);
  assert.ok(decision.reasoning.risk);
});

test("builds a seven-day decision report from local history", () => {
  const report = generateWeeklyDecisionReport([
    { id: "1", date: "2026-08-05T09:00:00.000Z", yearlyGoal: "100 位客户", chosenAction: "完成访谈", aiRecommendation: "完成访谈", userChoice: "follow-ai", outcome: "Execute", completionStatus: "completed", score: 90, risk: "缺少记录", biggestWaste: "会议" },
    { id: "2", date: "2026-08-04T09:00:00.000Z", yearlyGoal: "100 位客户", chosenAction: "联系客户", aiRecommendation: "联系客户", userChoice: "keep-plan", outcome: "Refine", completionStatus: "partial", score: 82, risk: "缺少记录", biggestWaste: "会议" },
  ], new Date("2026-08-06T12:00:00.000Z"));

  assert.equal(report.followAiRate, 50);
  assert.equal(report.keepMyPlanRate, 50);
  assert.equal(report.highestLeverageDecisions[0].score, 90);
  assert.equal(report.completionRate, 50);
  assert.equal(report.aiAdoptionRate, 50);
  assert.equal(report.decisionAccuracy, 100);
  assert.equal(report.highestLeverageWins[0].chosenAction, "完成访谈");
  assert.equal(report.mostCommonWaste, "会议");
  assert.deepEqual(report.repeatedRisks, ["缺少记录"]);
  assert.match(report.recommendation, /缺少记录/);
});

test("persists decision memory and exposes the weekly report", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");

  assert.match(page, /<summary>Why\?<\/summary>/);
  assert.match(page, /decisionHistory/);
  assert.match(page, /completionStatus: "pending"/);
  assert.match(page, /completionStatus: "completed"/);
  assert.match(page, /outcome: judgment\.outcome/);
  assert.match(page, /WEEKLY DECISION REPORT/);
  assert.match(page, /Completion rate/);
  assert.match(page, /AI adoption rate/);
  assert.match(page, /Decision accuracy/);
});

test("explains incomplete work and recommends a smaller next-day action", () => {
  const partial = explainIncompleteDecision("partial", "发布产品", "范围过大", "无法验证");
  const failed = explainIncompleteDecision("failed", "发布产品", "范围过大", "无法验证");

  assert.match(partial.explanation, /部分进展/);
  assert.match(partial.tomorrowRecommendation, /60 分钟/);
  assert.match(failed.explanation, /没有形成/);
  assert.match(failed.tomorrowRecommendation, /不要原样重试/);
});

test("migrates unversioned and version 1 storage to the latest schema", () => {
  const unversioned = migrateStoredState({ goal: "100 位客户", selectedAssets: ["SOP"] });
  assert.equal(unversioned.storageVersion, LATEST_STORAGE_VERSION);
  assert.deepEqual(unversioned.decisionHistory, []);
  assert.deepEqual(unversioned.assetDrafts, []);

  const versionOne = migrateStoredState({
    storageVersion: 1,
    completed: true,
    decisionHistory: [{ id: "old", score: 85, completionStatus: "completed" }],
  });
  assert.equal(versionOne.storageVersion, LATEST_STORAGE_VERSION);
  assert.equal(versionOne.completed, false);
  assert.equal(versionOne.completionResult, null);
  assert.equal(versionOne.decisionHistory[0].outcome, "Execute");
  assert.equal(versionOne.decisionHistory[0].completionStatus, "completed");
});

test("migrates version 2 profiles without allowing completed state to hide Step 1", () => {
  const storage = new MemoryStorage([[STORAGE_KEY, JSON.stringify({
    storageVersion: 2,
    goal: "保留的年度目标",
    completed: true,
    completionResult: "completed",
    activeDecisionId: "old-active-decision",
    decisionHistory: [{ id: "saved-history", score: 91, outcome: "Execute", completionStatus: "completed" }],
    assetDrafts: [],
  })]]);
  const initial = { storageVersion: LATEST_STORAGE_VERSION, goal: "", completed: false, completionResult: null, activeDecisionId: null, decisionHistory: [], assetDrafts: [] };
  const restored = loadStoredState(storage, initial, 12345);

  assert.equal(restored.storageVersion, LATEST_STORAGE_VERSION);
  assert.equal(restored.goal, "保留的年度目标");
  assert.equal(restored.completed, false);
  assert.equal(restored.completionResult, null);
  assert.equal(restored.activeDecisionId, null);
  assert.equal(restored.brainProvider, "openai");
  assert.equal(restored.decisionHistory.length, 1);
  assert.equal(JSON.parse(storage.getItem(STORAGE_KEY)).completed, false);
});

test("backs up corrupt storage and resets to a safe latest state", () => {
  const storage = new MemoryStorage([[STORAGE_KEY, "{broken-json"]]);
  const initial = { storageVersion: LATEST_STORAGE_VERSION, goal: "", decisionHistory: [], assetDrafts: [] };
  const restored = loadStoredState(storage, initial, 12345);

  assert.deepEqual(restored, initial);
  assert.equal(storage.getItem(`${STORAGE_BACKUP_PREFIX}12345`), "{broken-json");
  assert.deepEqual(JSON.parse(storage.getItem(STORAGE_KEY)), initial);
});

test("writes successful upgrades back to the primary storage key", () => {
  const storage = new MemoryStorage([[STORAGE_KEY, JSON.stringify({ goal: "旧目标" })]]);
  const initial = { storageVersion: LATEST_STORAGE_VERSION, goal: "", decisionHistory: [], assetDrafts: [] };
  const restored = loadStoredState(storage, initial, 12345);

  assert.equal(restored.goal, "旧目标");
  assert.equal(restored.storageVersion, LATEST_STORAGE_VERSION);
  assert.equal(JSON.parse(storage.getItem(STORAGE_KEY)).storageVersion, LATEST_STORAGE_VERSION);
});

test("keeps the mobile daily flow compact and its primary action visible", async () => {
  const [page, css] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(page, /window\.matchMedia\("\(max-width: 780px\)"\)\.matches/);
  assert.match(page, /if \(!window\.matchMedia[\s\S]*setStep\(1\)/);
  assert.match(page, /onClick=\{openGoal\}/);
  assert.match(css, /@media\(max-width:780px\)[\s\S]*\.stepper small\{display:none\}/);
  assert.match(css, /@media\(max-width:780px\)[\s\S]*\.sidebar nav\{display:flex/);
  assert.match(css, /\.sidebar nav \.system-stat[^}]*display:none/);
  assert.match(css, /@media\(max-width:780px\)[\s\S]*\.actions\{position:sticky/);
  assert.match(css, /env\(safe-area-inset-bottom\)/);
  assert.match(css, /min-height:100dvh/);
});

class MemoryStorage {
  #values;

  constructor(entries = []) {
    this.#values = new Map(entries);
  }

  getItem(key) {
    return this.#values.get(key) ?? null;
  }

  setItem(key, value) {
    this.#values.set(key, String(value));
  }
}

function makeBrainInput(selectedProvider = "rules", yearlyGoal = "获得 100 位客户", todayAction = "研究客户需求") {
  return {
    task: "decision",
    context: { yearlyGoal, todayAction, recentDecisionHistory: [], recentAssets: [], recentReviews: [], selectedProvider },
  };
}

function makeStructuredOutput() {
  return {
    outcome: "Execute",
    score: 88,
    verdict: "Execute",
    recommendation: "今天执行并收集真实反馈。",
    whyToday: "它直接推进年度目标，并能在今天形成外部证据。",
    biggestRisk: "范围扩大，导致今天无法交付。",
    higherLeverageAlternative: null,
    todayDeliverable: "今天发布 1 个可分享页面并记录 3 条用户反馈。",
    reasoning: {
      score: ["行动直接连接年度目标。", "今天可以产出可验证结果。"],
      risk: "如果不限制范围，交付时间会被推迟。",
      recommendation: "先完成最小版本，再根据反馈迭代。",
    },
  };
}

function makeApiEvaluation(provider) {
  const structured = makeStructuredOutput();
  return {
    prompt: "PROMPT_VERSION: decision.v1",
    rawResponse: JSON.stringify(structured),
    output: {
      ...structured,
      metadata: { provider, latencyMs: 12, tokenUsage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 }, fallback: false, attempts: 1, promptVersion: "decision.v1" },
    },
  };
}
