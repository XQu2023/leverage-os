import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { decisionEngine } from "../lib/decision-engine.ts";
import { generateAssetDrafts } from "../lib/asset-drafts.ts";
import { deriveBusinessMemory, emptyBusinessProfile, normalizeBusinessProfile, refreshBusinessProfile } from "../lib/business-profile.ts";
import { formatFutureValue, suggestCompound } from "../lib/compound-engine.ts";
import { explainIncompleteDecision, generateWeeklyDecisionReport } from "../lib/decision-memory.ts";
import { extractLearningLoop, formatLessonSummary, generateDecisionLesson, outcomeFromCompletion } from "../lib/decision-quality.ts";
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
  const drafts = generateAssetDrafts("获得 100 位客户", "完成 3 次客户访谈", "客户洞察模板");

  assert.match(page, /05 · LEAVE BEHIND/);
  assert.deepEqual(drafts.map((draft) => draft.type), ["SOP", "Prompt", "Template", "Knowledge Base"]);
  assert.ok(drafts.every((draft) => draft.content.includes("完成 3 次客户访谈")));
  assert.ok(drafts.every((draft) => draft.title.includes("客户洞察模板")));
  assert.match(page, /Preview/);
  assert.match(page, /Edit/);
  assert.match(page, /Saved ✓/);
  assert.match(page, /保存资产并继续/);
});

test("implements Compound Engine on Step 4 with generate-assets action", async () => {
  const [page, css] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  const proposal = suggestCompound("完成 3 次客户访谈");

  assert.match(page, /04 · COMPOUND ENGINE/);
  assert.match(page, /如何把今天的成果变成长期资产？/);
  assert.match(page, /AI 帮助你把今天的工作沉淀为未来可重复使用的资产。/);
  assert.match(page, /【资产】/);
  assert.match(page, /【为什么】/);
  assert.match(page, /【下一步】/);
  assert.match(page, /【未来价值】/);
  assert.match(page, /生成资产/);
  assert.match(page, /generateCompoundAssets/);
  assert.match(css, /\.compound-grid/);
  assert.equal(proposal.asset, "客户洞察模板");
  assert.equal(proposal.futureValue, 5);
  assert.equal(formatFutureValue(5), "★★★★★");
  assert.equal(formatFutureValue(3), "★★★☆☆");
});

test("implements Daily Review with all three saved prompts", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");

  assert.match(page, /Biggest Waste/);
  assert.match(page, /Best Asset Created/);
  assert.match(page, /Tomorrow&apos;s One Focus/);
  assert.match(page, /biggestWaste: data\.biggestWaste/);
  assert.match(page, /bestAsset: data\.bestAsset/);
  assert.match(page, /tomorrowFocus: data\.tomorrowFocus/);
  assert.match(page, /Success/);
  assert.match(page, /Partial Success/);
  assert.match(page, /Failed/);
  assert.match(page, /Did the prediction happen\?/);
  assert.match(page, /Wrong Assumption/);
  assert.match(page, /Next Time/);
  assert.match(page, /ledger: \{ \.\.\.entry\.ledger/);
});

test("implements Decision Quality Loop feedback, outcomes, and lessons", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const lesson = generateDecisionLesson({
    action: "完成访谈",
    result: "failed",
    adopted: true,
    rating: 2,
    prediction: "收集 3 条反馈",
    wrongAssumption: "客户会主动回复",
    nextTimeChange: "先预约再访谈",
    biggestWaste: "等待回复",
  });
  const loop = extractLearningLoop([
    {
      date: "2026-08-07T10:00:00.000Z",
      chosenAction: "完成访谈",
      quality: { rating: 2, adopted: true, result: "failed", lesson },
    },
  ]);

  assert.match(page, /Decision Feedback/);
  assert.match(page, /是否采纳 AI 建议/);
  assert.match(page, /decisionRating/);
  assert.match(page, /decisionAdopted/);
  assert.match(page, /generateDecisionLesson/);
  assert.match(page, /AI LESSON/);
  assert.equal(outcomeFromCompletion("completed"), "success");
  assert.equal(outcomeFromCompletion("partial"), "partial-success");
  assert.match(lesson.why, /失败/);
  assert.match(formatLessonSummary(lesson), /下次调整/);
  assert.equal(loop.recentFeedback.length, 1);
  assert.equal(loop.recentOutcomes[0].result, "failed");
  assert.equal(loop.recentLessons[0].wrongAssumption, "客户会主动回复");
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
  assert.ok(first.confidence >= 0 && first.confidence <= 100);
  assert.ok(first.experiment);
  assert.ok(first.opportunityCost);
  assert.ok(first.counterfactual);
});

test("keeps the two decision paths and local choice in the page state", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");

  assert.match(page, /brain\.inspect\(brainInput\)/);
  assert.doesNotMatch(page, /decisionEngine/);
  assert.match(page, /Follow AI/);
  assert.match(page, /Keep My Plan/);
  assert.match(page, /aiChoice: choice/);
  assert.match(page, /higherLeverageAlternative/);
  assert.doesNotMatch(page, /接受判断，继续/);
});

test("evaluates every provider through the same Brain interface", async () => {
  assert.deepEqual(BRAIN_OPTIONS.map((option) => option.label), ["Auto", "Rules", "OpenAI", "Claude (mock)", "Gemini (mock)"]);
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

test("calls browser fetch without binding the provider as its receiver", async () => {
  let called = false;
  const browserLikeFetch = async function () {
    if (this !== undefined) throw new TypeError("Illegal invocation");
    called = true;
    return Response.json(makeApiEvaluation("openai"));
  };
  const output = await new OpenAIBrainProvider(browserLikeFetch, "/api/brain/decision").evaluate(makeBrainInput("openai"));
  assert.equal(called, true);
  assert.equal(output.metadata.provider, "openai");
  assert.equal(output.metadata.fallback, false);
});

test("builds bounded provider context from goals, decisions, assets, and reviews", () => {
  const lesson = generateDecisionLesson({
    action: "完成访谈", result: "success", adopted: true, rating: 5,
    wrongAssumption: "无人响应", nextTimeChange: "保持预约流程", biggestWaste: "无",
  });
  const context = new ContextBuilder(2).build({
    yearlyGoal: " 100 位客户 ", todayAction: " 完成访谈 ", selectedProvider: "openai",
    businessProfile: { ...emptyBusinessProfile(), industry: "SaaS", coreAdvantage: "速度" },
    decisionHistory: [
      { id: 1, date: "2026-08-07", chosenAction: "完成访谈", quality: { rating: 5, adopted: true, result: "success", lesson } },
      { id: 2 },
      { id: 3 },
    ],
    assets: [{ id: "a" }, { id: "b" }, { id: "c" }],
    reviews: [{ id: "r1" }],
  });
  assert.equal(context.yearlyGoal, "100 位客户");
  assert.equal(context.todayAction, "完成访谈");
  assert.equal(context.businessProfile.industry, "SaaS");
  assert.equal(context.businessProfile.coreAdvantage, "速度");
  assert.equal(context.businessProfile.yearlyGoal, "100 位客户");
  assert.equal(context.recentDecisionHistory.length, 2);
  assert.equal(context.recentAssets.length, 2);
  assert.equal(context.recentReviews.length, 1);
  assert.equal(context.recentFeedback[0].rating, 5);
  assert.equal(context.recentOutcomes[0].result, "success");
  assert.equal(context.recentLessons[0].decision, "完成访谈");
  assert.equal(context.selectedProvider, "openai");
});

test("builds Brain memory from the last 30 ledger decisions", () => {
  const history = Array.from({ length: 35 }, (_, index) => ({
    id: index,
    ledger: {
      outcome: index < 10 ? "happened" : index < 20 ? "partial" : "did-not-happen",
      wrongAssumption: index < 3 ? "范围太大" : index < 5 ? "反馈会自动出现" : "",
    },
  }));
  const context = new ContextBuilder().build({ yearlyGoal: "目标", todayAction: "行动", selectedProvider: "rules", decisionHistory: history, assets: [], reviews: [], businessProfile: emptyBusinessProfile() });
  assert.equal(context.recentDecisionHistory.length, 30);
  assert.equal(context.predictionAccuracy, 50);
  assert.deepEqual(context.recurringMistakes, ["范围太大", "反馈会自动出现"]);
  assert.ok(context.businessProfile);
});

test("derives and persists Business Memory from decisions, assets, and reviews", () => {
  const now = new Date("2026-08-07T12:00:00.000Z");
  const memory = deriveBusinessMemory({
    goal: "100 位客户",
    decisionHistory: [
      { date: "2026-08-06T09:00:00.000Z", chosenAction: "完成访谈", completionStatus: "completed", score: 90, ledger: { outcome: "happened" } },
      { date: "2026-08-05T09:00:00.000Z", chosenAction: "冷启动广告", completionStatus: "failed", biggestWaste: "渠道不匹配", ledger: { outcome: "did-not-happen" } },
    ],
    reviews: [{ date: "2026-08-06T20:00:00.000Z", action: "完成访谈", bestAsset: "访谈模板", tomorrowFocus: "跟进 3 位客户", biggestWaste: "记录不完整" }],
    selectedAssets: ["客户跟进 SOP"],
    assetDrafts: [{ title: "访谈 Prompt", status: "saved" }],
  }, now);

  assert.deepEqual(memory.recentProjects, ["完成访谈", "冷启动广告"]);
  assert.deepEqual(memory.recentSuccesses, ["完成访谈"]);
  assert.ok(memory.recentFailures.includes("渠道不匹配"));
  assert.ok(memory.mostValuableAssets.includes("客户跟进 SOP"));
  assert.ok(memory.mostValuableAssets.includes("访谈模板"));
  assert.ok(memory.last30DaysFocus.includes("跟进 3 位客户"));

  const profile = refreshBusinessProfile(normalizeBusinessProfile({ industry: "教育" }, "旧目标"), {
    goal: "100 位客户",
    decisionHistory: [],
    reviews: [],
    selectedAssets: [],
    assetDrafts: [],
  }, now);
  assert.equal(profile.industry, "教育");
  assert.equal(profile.yearlyGoal, "100 位客户");
});

test("exposes an editable Business Profile view with AI-maintained memory", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(page, /BUSINESS PROFILE/);
  assert.match(page, /onClick=\{openProfile\}/);
  assert.match(page, /function BusinessProfileView/);
  assert.match(page, /一年目标/);
  assert.match(page, /行业/);
  assert.match(page, /商业模式/);
  assert.match(page, /当前阶段/);
  assert.match(page, /核心优势/);
  assert.match(page, /当前约束/);
  assert.match(page, /决策原则/);
  assert.match(page, /最近主要项目/);
  assert.match(page, /最近成功经验/);
  assert.match(page, /最近失败经验/);
  assert.match(page, /最有价值资产/);
  assert.match(page, /最近30天重点/);
  assert.match(page, /businessProfile,/);
  assert.match(page, /refreshBusinessProfile/);
  assert.match(page, /AI MEMORY/);
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
    assert.match(prompt, /businessProfile/);
    assert.match(prompt, /recentFeedback/);
    assert.match(prompt, /recentOutcomes/);
    assert.match(prompt, /recentLessons/);
  }
});

test("enforces one structured JSON output schema for provider responses", async () => {
  const trace = await createBrain("claude").inspect(makeBrainInput("claude"));
  const structuredOutput = { ...trace.parsedOutput };
  delete structuredOutput.metadata;
  assert.deepEqual(parseBrainOutput(trace.rawResponse), structuredOutput);
  assert.throws(() => parseBrainOutput('{"outcome":"Execute"}'), /missing required fields/);
  assert.throws(() => parseBrainOutput('{broken'), SyntaxError);
  assert.throws(() => parseBrainOutput(JSON.stringify({ ...makeStructuredOutput(), confidence: 101 })), /Invalid Brain confidence/);
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
  assert.equal(result.validation.status, "passed");
  assert.equal(result.validation.deliverable, true);
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
  assert.equal(result.validation.status, "fallback");
  assert.equal(result.validation.schema, false);
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
  assert.match(result.validation.message, /OPENAI_API_KEY/);
});

test("keeps Brain Inspector behind an explicit debug toggle without initial production markup", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const response = await render();
  const html = await response.text();
  assert.match(page, /debugOpen && developerTrace/);
  assert.match(page, /Brain Inspector/);
  assert.match(page, /Context/);
  assert.match(page, /Prompt/);
  assert.match(page, /Raw Response/);
  assert.match(page, /Parsed Output/);
  assert.match(page, /Validation/);
  assert.doesNotMatch(html, /Brain Inspector/);
});

test("adds status, persisted provider modes, comparison, trace, and usage monitoring", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(page, /BRAIN STATUS/);
  assert.match(page, /Model/);
  assert.match(page, /Latency/);
  assert.match(page, /Fallback/);
  assert.match(page, /Updated/);
  assert.match(page, /brainProvider: "auto"/);
  assert.match(page, /Promise\.all\(\[createBrain\("rules"\)\.inspect\(brainInput\), createBrain\("openai"\)\.inspect\(brainInput\)\]\)/);
  assert.match(page, /Rules vs OpenAI/);
  assert.match(page, /Total calls/);
  assert.match(page, /Estimated cost/);
  assert.match(page, /fallbackCount/);
});

test("migrates V2.2 storage to Auto mode and initializes usage totals", () => {
  const migrated = migrateStoredState({ storageVersion: 5, brainProvider: "openai", decisionHistory: [], assetDrafts: [] });
  assert.equal(migrated.storageVersion, LATEST_STORAGE_VERSION);
  assert.equal(migrated.brainProvider, "auto");
  assert.deepEqual(migrated.brainUsage, { totalCalls: 0, inputTokens: 0, outputTokens: 0, totalTokens: 0, estimatedCostUsd: 0, fallbackCount: 0 });
});

test("migrates V3 decision history into the Decision Ledger", () => {
  const migrated = migrateStoredState({
    storageVersion: 6,
    brainProvider: "auto",
    brainUsage: {},
    decisionHistory: [{ id: "old", chosenAction: "发布页面", aiRecommendation: "收集反馈", score: 82, outcome: "Execute", completionStatus: "completed" }],
    reviews: [{ date: "2026-08-01", action: "发布页面" }],
    assetDrafts: [],
  });
  assert.equal(migrated.storageVersion, LATEST_STORAGE_VERSION);
  assert.deepEqual(migrated.decisionHistory[0].ledger, {
    decision: "发布页面", prediction: "收集反馈", outcome: "pending", confidence: 82,
    lesson: "", wrongAssumption: "", nextTimeChange: "",
  });
  assert.equal(migrated.reviews[0].predictionResult, "did-not-happen");
});

test("migrates V3.2 storage into Business Profile memory", () => {
  const migrated = migrateStoredState({
    storageVersion: 7,
    goal: "做到 100 万年收入",
    brainProvider: "auto",
    brainUsage: {},
    decisionHistory: [],
    assetDrafts: [],
  });
  assert.equal(migrated.storageVersion, LATEST_STORAGE_VERSION);
  assert.equal(migrated.businessProfile.yearlyGoal, "做到 100 万年收入");
  assert.deepEqual(migrated.businessProfile.recentProjects, []);
  assert.equal(migrated.businessProfile.industry, "");
});

test("migrates V3.3 storage into Decision Quality Loop fields", () => {
  const migrated = migrateStoredState({
    storageVersion: 8,
    goal: "100 位客户",
    brainProvider: "auto",
    brainUsage: {},
    businessProfile: emptyBusinessProfile(),
    decisionHistory: [{
      id: "q1",
      chosenAction: "发布页面",
      quality: {
        rating: 4,
        adopted: false,
        result: "partial-success",
        lesson: { why: "部分完成", correctAssumption: "方向对", wrongAssumption: "范围过大", nextAdjustment: "缩小范围" },
      },
    }],
    assetDrafts: [],
  });
  assert.equal(migrated.storageVersion, LATEST_STORAGE_VERSION);
  assert.equal(migrated.decisionRating, null);
  assert.equal(migrated.decisionAdopted, null);
  assert.equal(migrated.decisionHistory[0].quality.rating, 4);
  assert.equal(migrated.decisionHistory[0].quality.result, "partial-success");
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
  assert.equal(restored.brainProvider, "auto");
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
    context: {
      yearlyGoal,
      todayAction,
      businessProfile: { ...emptyBusinessProfile(), yearlyGoal },
      recentDecisionHistory: [],
      recentAssets: [],
      recentReviews: [],
      recentFeedback: [],
      recentOutcomes: [],
      recentLessons: [],
      predictionAccuracy: 0,
      recurringMistakes: [],
      selectedProvider,
    },
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
    confidence: 84,
    experiment: "今天发布 1 个页面并向 3 位用户收集反馈。",
    opportunityCost: "今天不会推进其他低确定性事项。",
    counterfactual: "如果不发布，将失去今天获得真实用户证据的机会。",
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
    validation: { status: "passed", schema: true, reasoning: true, deliverable: true, message: "All validation checks passed." },
    output: {
      ...structured,
      metadata: { provider, model: provider === "openai" ? "test-model" : "Rule Engine", latencyMs: 12, tokenUsage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 }, fallback: false, attempts: 1, promptVersion: "decision.v1", estimatedCostUsd: 0.0001 },
    },
  };
}
