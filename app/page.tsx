"use client";

import { useEffect, useMemo, useState } from "react";
import { BRAIN_OPTIONS, ContextBuilder, createBrain, type BrainMode, type BrainOutput, type BrainProviderId, type BrainTrace } from "@/lib/brain";
import { generateAssetDrafts, type AssetDraft } from "@/lib/asset-drafts";
import { explainIncompleteDecision, generateWeeklyDecisionReport, type DecisionChoice, type DecisionHistoryEntry, type WeeklyDecisionReport } from "@/lib/decision-memory";
import { LATEST_STORAGE_VERSION, STORAGE_KEY, loadStoredState } from "@/lib/storage";

type Review = {
  date: string;
  action: string;
  biggestWaste: string;
  bestAsset: string;
  tomorrowFocus: string;
  multiplier: string;
  predictionResult: "happened" | "partial" | "did-not-happen";
  wrongAssumption: string;
  nextTimeChange: string;
};

type View = "today" | "assets" | "reviews" | "weekly";
type AiChoice = DecisionChoice | null;
const contextBuilder = new ContextBuilder();

type BrainUsage = { totalCalls: number; inputTokens: number; outputTokens: number; totalTokens: number; estimatedCostUsd: number; fallbackCount: number };
const emptyBrainUsage: BrainUsage = { totalCalls: 0, inputTokens: 0, outputTokens: 0, totalTokens: 0, estimatedCostUsd: 0, fallbackCount: 0 };

type State = {
  storageVersion: typeof LATEST_STORAGE_VERSION;
  goal: string;
  action: string;
  multiplier: string;
  completed: boolean;
  assets: string[];
  selectedAssets: string[];
  biggestWaste: string;
  bestAsset: string;
  tomorrowFocus: string;
  reviews: Review[];
  aiChoice: AiChoice;
  decisionHistory: DecisionHistoryEntry[];
  activeDecisionId: string | null;
  assetDrafts: AssetDraft[];
  completionResult: "completed" | "partial" | "failed" | null;
  brainProvider: BrainMode;
  brainUsage: BrainUsage;
  predictionResult: "happened" | "partial" | "did-not-happen" | null;
  wrongAssumption: string;
  nextTimeChange: string;
};

const initialState: State = {
  storageVersion: LATEST_STORAGE_VERSION,
  goal: "",
  action: "",
  multiplier: "",
  completed: false,
  assets: [],
  selectedAssets: [],
  biggestWaste: "",
  bestAsset: "",
  tomorrowFocus: "",
  reviews: [],
  aiChoice: null,
  decisionHistory: [],
  activeDecisionId: null,
  assetDrafts: [],
  completionResult: null,
  brainProvider: "auto",
  brainUsage: emptyBrainUsage,
  predictionResult: null,
  wrongAssumption: "",
  nextTimeChange: "",
};

function suggestMultiplier(action: string) {
  if (/客户|销售|联系|访谈|用户/.test(action)) return "把一次对话变成可复用的客户洞察模板";
  if (/内容|发布|文章|视频|写/.test(action)) return "设计一个可持续复用的发布流程";
  if (/产品|开发|功能|上线|测试/.test(action)) return "先交付最小版本，用真实反馈放大下一步";
  return "完成后提炼模板，让这次成果可以被重复使用";
}

function suggestAssets(action: string) {
  const context = /客户|销售|联系|访谈|用户/.test(action)
    ? ["客户跟进 SOP", "客户访谈 Prompt", "客户案例", "客户决策原则"]
    : /内容|发布|文章|视频|写/.test(action)
      ? ["内容发布 SOP", "内容生成 Prompt", "内容案例", "选题决策原则"]
      : /产品|开发|功能|上线|测试/.test(action)
        ? ["产品发布 SOP", "产品测试 Prompt", "用户案例", "产品决策原则"]
        : ["执行 SOP", "复用 Prompt", "客户案例", "决策原则"];
  return context;
}

export default function Home() {
  const [data, setData] = useState<State>(initialState);
  const [hydrated, setHydrated] = useState(false);
  const [step, setStep] = useState(1);
  const [view, setView] = useState<View>("today");
  const [selectedAsset, setSelectedAsset] = useState<string | null>(null);
  const [selectedReview, setSelectedReview] = useState<number | null>(null);
  const [previewDraftId, setPreviewDraftId] = useState<string | null>(null);
  const [editingDraftId, setEditingDraftId] = useState<string | null>(null);
  const [brainEvaluation, setBrainEvaluation] = useState<{ key: string; output: BrainOutput } | null>(null);
  const [brainTrace, setBrainTrace] = useState<{ key: string; trace: BrainTrace } | null>(null);
  const [brainComparison, setBrainComparison] = useState<{ key: string; rules: BrainTrace; openai: BrainTrace } | null>(null);
  const [compareMode, setCompareMode] = useState(false);
  const [debugOpen, setDebugOpen] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  useEffect(() => {
    try {
      const stored = loadStoredState(window.localStorage, initialState);
      const assets = suggestAssets(stored.action);
      const selectedAssets = stored.selectedAssets.filter((asset) => typeof asset === "string");
      setData({ ...stored, assets, selectedAssets });
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (hydrated) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [data, hydrated]);

  const activeProvider: BrainProviderId = data.brainProvider === "auto" ? "openai" : data.brainProvider;
  const brain = useMemo(() => createBrain(activeProvider), [activeProvider]);
  const brainContext = useMemo(() => contextBuilder.build({
    yearlyGoal: data.goal,
    todayAction: data.action,
    decisionHistory: data.decisionHistory,
    assets: data.assetDrafts.filter((draft) => draft.status === "saved"),
    reviews: data.reviews,
    selectedProvider: activeProvider,
  }), [data.goal, data.action, data.decisionHistory, data.assetDrafts, data.reviews, activeProvider]);
  const brainInput = useMemo(() => ({ task: "decision" as const, context: brainContext }), [brainContext]);
  const evaluationKey = JSON.stringify(brainInput);
  useEffect(() => {
    if (step !== 3) return;
    let active = true;
    const run = compareMode
      ? Promise.all([createBrain("rules").inspect(brainInput), createBrain("openai").inspect(brainInput)])
          .then(([rules, openai]) => ({ primary: activeProvider === "rules" ? rules : openai, traces: [rules, openai], comparison: { key: evaluationKey, rules, openai } }))
      : brain.inspect(brainInput).then((trace) => ({ primary: trace, traces: [trace], comparison: null }));
    run.then(({ primary, traces, comparison }) => {
      if (!active) return;
      setBrainEvaluation({ key: evaluationKey, output: primary.parsedOutput });
      setBrainTrace({ key: evaluationKey, trace: primary });
      setBrainComparison(comparison);
      setLastUpdated(new Date().toISOString());
      setData((current) => ({ ...current, brainUsage: addBrainUsage(current.brainUsage, traces.map((trace) => trace.parsedOutput)) }));
    });
    return () => { active = false; };
  }, [activeProvider, brain, brainInput, compareMode, evaluationKey, step]);
  const judgment = brainEvaluation?.key === evaluationKey ? brainEvaluation.output : null;
  const developerTrace = brainTrace?.key === evaluationKey ? brainTrace.trace : null;
  const comparison = brainComparison?.key === evaluationKey ? brainComparison : null;
  const weeklyReport = useMemo(() => generateWeeklyDecisionReport(data.decisionHistory), [data.decisionHistory]);
  const today = hydrated
    ? new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric", weekday: "long" }).format(new Date())
    : "今天";
  const progress = Math.round(((step - 1) / 5) * 100);
  const update = (patch: Partial<State>) => setData((current) => ({ ...current, ...patch }));

  function goToStep(nextStep: number) {
    if (nextStep === 5 && data.assetDrafts.length !== 4) {
      const assets = suggestAssets(data.action);
      update({ assets, assetDrafts: generateAssetDrafts(data.goal, data.action) });
    }
    setStep(nextStep);
  }

  function next() {
    if (step === 2 && !data.multiplier) update({ multiplier: suggestMultiplier(data.action) });
    goToStep(Math.min(6, step + 1));
  }

  function chooseAiPath(choice: Exclude<AiChoice, null>) {
    if (!judgment) return;
    const followAlternative = choice === "follow-ai" && judgment.higherLeverageAlternative;
    const action = followAlternative || data.action;
    const id = data.activeDecisionId ?? `${Date.now()}-${data.decisionHistory.length}`;
    const entry: DecisionHistoryEntry = {
      id,
      date: new Date().toISOString(),
      yearlyGoal: data.goal,
      chosenAction: action,
      aiRecommendation: judgment.recommendation,
      userChoice: choice,
      completionStatus: "pending",
      outcome: judgment.outcome,
      score: judgment.score,
      risk: judgment.biggestRisk,
      biggestWaste: "",
      provider: judgment.metadata.provider,
      latencyMs: judgment.metadata.latencyMs,
      tokenUsage: judgment.metadata.tokenUsage,
      fallback: judgment.metadata.fallback,
      ledger: {
        decision: action,
        prediction: judgment.todayDeliverable,
        outcome: "pending",
        confidence: judgment.confidence,
        lesson: "",
        wrongAssumption: "",
        nextTimeChange: "",
      },
    };
    const decisionHistory = data.activeDecisionId
      ? data.decisionHistory.map((item) => item.id === id ? entry : item)
      : [entry, ...data.decisionHistory];
    update({ aiChoice: choice, action, multiplier: suggestMultiplier(action), activeDecisionId: id, decisionHistory });
    goToStep(4);
  }

  function updateAssetDraft(id: string, patch: Partial<AssetDraft>) {
    update({ assetDrafts: data.assetDrafts.map((draft) => draft.id === id ? { ...draft, ...patch } : draft) });
  }

  function saveAssetDraft(id: string) {
    const draft = data.assetDrafts.find((item) => item.id === id);
    if (!draft) return;
    update({
      assetDrafts: data.assetDrafts.map((item) => item.id === id ? { ...item, status: "saved" } : item),
      selectedAssets: data.selectedAssets.includes(draft.title) ? data.selectedAssets : [...data.selectedAssets, draft.title],
    });
    setEditingDraftId(null);
  }

  function saveReview(completionStatus: "completed" | "partial" | "failed") {
    if (!canSaveReview) return;
    const review = { date: new Date().toISOString(), action: data.action, biggestWaste: data.biggestWaste, bestAsset: data.bestAsset, tomorrowFocus: data.tomorrowFocus, multiplier: data.multiplier, predictionResult: data.predictionResult!, wrongAssumption: data.wrongAssumption, nextTimeChange: data.nextTimeChange };
    const incomplete = completionStatus === "completed" ? null : explainIncompleteDecision(completionStatus, data.action, data.biggestWaste, judgment?.biggestRisk ?? "完成标准未被验证");
    const decisionHistory = data.decisionHistory.map((entry) => entry.id === data.activeDecisionId
      ? { ...entry, completionStatus, biggestWaste: data.biggestWaste, aiExplanation: incomplete?.explanation, tomorrowRecommendation: incomplete?.tomorrowRecommendation, ledger: { ...entry.ledger, outcome: data.predictionResult!, wrongAssumption: data.wrongAssumption, nextTimeChange: data.nextTimeChange, lesson: `错误假设：${data.wrongAssumption}；下次改变：${data.nextTimeChange}` } }
      : entry);
    update({ reviews: [review, ...data.reviews], decisionHistory, completionResult: completionStatus, completed: true });
  }

  const canContinue = step === 1 ? data.goal.trim().length > 8 : step === 2 ? data.action.trim().length > 5 : true;
  const canSaveReview = Boolean(data.biggestWaste.trim() && data.bestAsset.trim() && data.tomorrowFocus.trim() && data.predictionResult && data.wrongAssumption.trim() && data.nextTimeChange.trim());
  const openToday = () => {
    setView("today");
    setSelectedAsset(null);
    setSelectedReview(null);
  };

  function openGoal() {
    openToday();
    if (!window.matchMedia("(max-width: 780px)").matches) setStep(1);
  }

  function openAssets() {
    setView("assets");
    setSelectedAsset(null);
  }

  function openReviews() {
    setView("reviews");
    setSelectedReview(null);
  }

  function openWeekly() {
    setView("weekly");
    setSelectedAsset(null);
    setSelectedReview(null);
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark">L</span><span>Leverage OS</span></div>
        <nav aria-label="主要导航">
          <button className={`nav-item ${view === "today" ? "active" : ""}`} onClick={openToday}><span>◆</span> Today</button>
          <button className="nav-item" onClick={openGoal}><span>↗</span> One-Year Goal</button>
          <button className={`nav-item ${view === "weekly" ? "active" : ""}`} onClick={openWeekly}><span>◎</span> Weekly Report</button>
          <div className="nav-spacer" />
          <p className="nav-label">YOUR SYSTEM</p>
          <button className={`system-stat ${view === "assets" ? "active" : ""}`} onClick={openAssets} aria-label={`查看留下的资产，共 ${data.selectedAssets.length} 项`}><span>留下的资产</span><strong>{data.selectedAssets.length}</strong></button>
          <button className={`system-stat ${view === "reviews" ? "active" : ""}`} onClick={openReviews} aria-label={`查看完成的日回顾，共 ${data.reviews.length} 项`}><span>完成的日回顾</span><strong>{data.reviews.length}</strong></button>
        </nav>
        <div className="sidebar-foot"><div className="avatar">YO</div><div><strong>Your OS</strong><small>本地私人空间</small></div></div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div><span className="eyebrow">TODAY</span><h1>{today}</h1></div>
          <div className="progress-wrap"><span>{progress}% complete</span><div className="progress"><i style={{ width: `${progress}%` }} /></div></div>
        </header>

        <div className="content">
          {view === "assets" && <LibraryView title="留下的资产" kicker="ASSET LIBRARY" empty="完成今日流程后，保存的 SOP、Prompt、案例与决策原则会出现在这里。" onBack={openToday}>
            {selectedAsset ? <DetailCard label="SAVED ASSET" title={selectedAsset} onBack={() => setSelectedAsset(null)}>
              <p>这是你在今日工作中选择保留的可复用资产。它保存在当前设备的私人空间中。</p>
              {data.action && <><span className="detail-label">来源行动</span><p>{data.action}</p></>}
            </DetailCard> : data.selectedAssets.map((asset, index) => <button className="library-row" key={`${asset}-${index}`} onClick={() => setSelectedAsset(asset)}><span><small>ASSET {String(index + 1).padStart(2, "0")}</small><strong>{asset}</strong></span><i>→</i></button>)}
          </LibraryView>}

          {view === "reviews" && <LibraryView title="完成的日回顾" kicker="REVIEW LIBRARY" empty="完成一次日回顾后，它会按时间保存在这里。" onBack={openToday}>
            {selectedReview !== null && data.reviews[selectedReview] ? <ReviewDetail review={data.reviews[selectedReview]} onBack={() => setSelectedReview(null)} /> : data.reviews.map((review, index) => <button className="library-row" key={`${review.date}-${index}`} onClick={() => setSelectedReview(index)}><span><small>{formatReviewDate(review.date)}</small><strong>{review.action || "今日回顾"}</strong></span><i>→</i></button>)}
          </LibraryView>}

          {view === "weekly" && <WeeklyReportView report={weeklyReport} onBack={openToday} />}

          {view === "today" && <>
          <div className="stepper" aria-label="今日流程">
            {["年度目标", "最高杠杆", "AI 判断", "今日乘数", "留下资产", "日回顾"].map((label, index) => (
              <button key={label} className={step === index + 1 ? "current" : step > index + 1 ? "done" : ""} onClick={() => step > index + 1 && goToStep(index + 1)}>
                <span>{step > index + 1 ? "✓" : index + 1}</span><small>{label}</small>
              </button>
            ))}
          </div>

          <div className="stage" key={step}>
            {step === 1 && <>
              <p className="kicker">01 · ONE-YEAR GOAL</p>
              <h2>一年后，什么结果会真正改变你的处境？</h2>
              <p className="lead">只保留一个目标。它将成为每天判断取舍的唯一坐标。</p>
              <textarea className="hero-input" value={data.goal} onChange={(e) => update({ goal: e.target.value })} placeholder="例如：在 12 个月内，让产品达到 100 万年收入…" autoFocus />
              <p className="input-hint">清晰、可衡量、有截止时间</p>
            </>}

            {step === 2 && <>
              <p className="kicker">02 · TODAY&apos;S HIGHEST LEVERAGE ACTION</p>
              <h2>今天哪一个行动，最能推动这个目标？</h2>
              <div className="goal-context"><span>一年目标</span><p>{data.goal}</p></div>
              <textarea className="hero-input" value={data.action} onChange={(e) => update({ action: e.target.value, aiChoice: null, activeDecisionId: null })} placeholder="写下一个今天可以完成、会产生真实结果的行动…" autoFocus />
              <div className="constraint"><span>1</span><p><strong>只选一个</strong><br />不是待办清单，而是今天最重要的下注。</p></div>
            </>}

            {step === 3 && <>
              <p className="kicker">03 · AI JUDGMENT</p>
              <h2>这个行动值得你投入今天吗？</h2>
              <BrainSelector value={data.brainProvider} onChange={(brainProvider) => update({ brainProvider })} />
              <div className="brain-tools"><button type="button" className={compareMode ? "active" : ""} onClick={() => setCompareMode((value) => !value)}>Compare {compareMode ? "On" : "Off"}</button><button type="button" className={debugOpen ? "active" : ""} onClick={() => setDebugOpen((value) => !value)}>Debug</button></div>
              {judgment ? <>
              <BrainStatus output={judgment} lastUpdated={lastUpdated} mode={data.brainProvider} />
              <div className="judgment-card">
                <div className="score-ring" style={{ "--score": `${judgment.score * 3.6}deg` } as React.CSSProperties}><span>{judgment.score}</span><small>/ 100</small></div>
                <div><span className="verdict">{judgment.verdict}</span><h3>{data.action}</h3><p>{judgment.whyToday}</p></div>
              </div>
              <div className="criteria"><div><span>!</span><p><strong>最大风险</strong><br />{judgment.biggestRisk}</p></div><div><span>↑</span><p><strong>更高杠杆选择</strong><br />{judgment.higherLeverageAlternative ?? "当前计划已经足够直接，建议保持。"}</p></div><div><span>✓</span><p><strong>今日交付物</strong><br />{judgment.todayDeliverable}</p></div></div>
              <details className="decision-reasoning"><summary>Why?</summary><div><strong>置信度</strong><p>{judgment.confidence}%</p><strong>评分依据</strong><ul>{judgment.reasoning.score.map((reason) => <li key={reason}>{reason}</li>)}</ul><strong>实验</strong><p>{judgment.experiment}</p><strong>机会成本</strong><p>{judgment.opportunityCost}</p><strong>反事实</strong><p>{judgment.counterfactual}</p><strong>风险依据</strong><p>{judgment.reasoning.risk}</p><strong>建议依据</strong><p>{judgment.reasoning.recommendation}</p></div></details>
              {compareMode && comparison && <ComparisonView rules={comparison.rules.parsedOutput} openai={comparison.openai.parsedOutput} />}
              {debugOpen && developerTrace && <BrainInspector trace={developerTrace} usage={data.brainUsage} />}
              </> : <div className="judgment-card brain-loading"><span className="verdict">Evaluating</span><p>Brain 正在生成判断…</p></div>}
            </>}

            {step === 4 && <>
              <p className="kicker">04 · TODAY&apos;S MULTIPLIER</p>
              <h2>怎样让今天的成果不只发生一次？</h2>
              <p className="lead">AI 根据你的行动找到一个最简单的放大方式。你可以直接修改。</p>
              <div className="ai-proposal"><span className="spark">✦</span><div><small>AI 建议的乘数</small><textarea value={data.multiplier} onChange={(e) => update({ multiplier: e.target.value })} /></div></div>
              <p className="why">这会把一次性的努力，转化为下一次可以直接调用的起点。</p>
            </>}

            {step === 5 && <>
              <p className="kicker">05 · LEAVE BEHIND</p>
              <h2>完成之后，你要留下什么？</h2>
              <p className="lead">好的工作会消失，除非你把它变成资产。选择今天要保存的成果。</p>
              <div className="asset-grid">
                {data.assetDrafts.map((draft, i) => <article key={draft.id} className={draft.status === "saved" ? "asset selected" : "asset"}><span>{["▤", "◇", "◎", "◆"][i]}</span><div><strong>{draft.type}</strong><small>{draft.title}</small><div className="asset-actions"><button onClick={() => { setPreviewDraftId(draft.id); setEditingDraftId(null); }}>Preview</button><button onClick={() => { setPreviewDraftId(draft.id); setEditingDraftId(draft.id); }}>Edit</button><button onClick={() => saveAssetDraft(draft.id)}>{draft.status === "saved" ? "Saved ✓" : "Save"}</button></div></div></article>)}
              </div>
              {previewDraftId && data.assetDrafts.find((draft) => draft.id === previewDraftId) && (() => { const draft = data.assetDrafts.find((item) => item.id === previewDraftId)!; return <div className="asset-preview"><small>{draft.type} DRAFT</small><h3>{draft.title}</h3>{editingDraftId === draft.id ? <textarea value={draft.content} onChange={(event) => updateAssetDraft(draft.id, { content: event.target.value, status: "draft" })} /> : <p>{draft.content}</p>}<button className="detail-back" onClick={() => { setPreviewDraftId(null); setEditingDraftId(null); }}>关闭</button></div>; })()}
              <p className="selection-status">已保存 {data.assetDrafts.filter((draft) => draft.status === "saved").length} 项资产</p>
              <div className="multiplier-note"><span>今日乘数</span>{data.multiplier}</div>
            </>}

            {step === 6 && <>
              <p className="kicker">06 · DAILY REVIEW</p>
              <h2>{data.completed ? "今天的复利已经开始。" : "用一次复盘，结束今天。"}</h2>
              {data.completed ? <div className="completion">
                <div className="completion-mark">{data.completionResult === "completed" ? "✓" : data.completionResult === "partial" ? "◐" : "×"}</div><h3>Daily review saved</h3><p>结果：{completionLabel(data.completionResult)}。你留下了 {data.selectedAssets.length} 项可复用资产。</p>
                <div className="summary-row"><span>行动</span><strong>{data.action}</strong></div><div className="summary-row"><span>乘数</span><strong>{data.multiplier}</strong></div>
                {data.completionResult !== "completed" && data.activeDecisionId && (() => { const entry = data.decisionHistory.find((item) => item.id === data.activeDecisionId); return entry ? <div className="incomplete-guidance"><strong>AI explanation</strong><p>{entry.aiExplanation}</p><strong>Tomorrow&apos;s recommendation</strong><p>{entry.tomorrowRecommendation}</p></div> : null; })()}
                <button className="secondary" onClick={() => { update({ action: "", multiplier: "", completed: false, assets: [], selectedAssets: [], biggestWaste: "", bestAsset: "", tomorrowFocus: "", predictionResult: null, wrongAssumption: "", nextTimeChange: "", aiChoice: null, activeDecisionId: null, assetDrafts: [], completionResult: null }); setStep(2); }}>开始新的一天 →</button>
              </div> : <div className="review-form">
                <label><span>Biggest Waste</span><strong>今天最大的浪费是什么？</strong><textarea value={data.biggestWaste} onChange={(e) => update({ biggestWaste: e.target.value })} placeholder="以后可以删除、委派或自动化什么？" /></label>
                <label><span>Best Asset Created</span><strong>今天留下的最佳资产是什么？</strong><textarea value={data.bestAsset} onChange={(e) => update({ bestAsset: e.target.value })} placeholder="SOP、Prompt、案例或决策原则…" /></label>
                <label><span>Tomorrow&apos;s One Focus</span><strong>明天唯一的重点是什么？</strong><textarea value={data.tomorrowFocus} onChange={(e) => update({ tomorrowFocus: e.target.value })} placeholder="只写一个最值得推进的结果…" /></label>
                <fieldset className="prediction-review"><legend>Did the prediction happen?</legend><div>{(["happened", "partial", "did-not-happen"] as const).map((result) => <button type="button" key={result} className={data.predictionResult === result ? "active" : ""} onClick={() => update({ predictionResult: result })}>{predictionResultLabel(result)}</button>)}</div></fieldset>
                <label><span>Wrong Assumption</span><strong>哪个假设错了？</strong><textarea value={data.wrongAssumption} onChange={(e) => update({ wrongAssumption: e.target.value })} placeholder="写下事实推翻了哪个假设…" /></label>
                <label><span>Next Time</span><strong>下次应该改变什么？</strong><textarea value={data.nextTimeChange} onChange={(e) => update({ nextTimeChange: e.target.value })} placeholder="记录一个具体的决策规则或行动变化…" /></label>
              </div>}
            </>}

            {!data.completed && <div className="actions">
              {step > 1 && <button className="back" onClick={() => setStep(step - 1)}>← 返回</button>}
              {step === 3 ? <><button className="secondary" disabled={!judgment} onClick={() => chooseAiPath("keep-plan")}>Keep My Plan</button><button className="primary" disabled={!judgment} onClick={() => chooseAiPath("follow-ai")}>Follow AI<span>→</span></button></> : step === 6 ? <div className="completion-actions"><button disabled={!canSaveReview} onClick={() => saveReview("failed")}>Failed</button><button disabled={!canSaveReview} onClick={() => saveReview("partial")}>Partial</button><button className="primary" disabled={!canSaveReview} onClick={() => saveReview("completed")}>Completed<span>→</span></button></div> : <button className="primary" disabled={!canContinue || (step === 5 && data.assetDrafts.every((draft) => draft.status !== "saved"))} onClick={next}>{step === 5 ? "保存资产并继续" : "继续"}<span>→</span></button>}
            </div>}
          </div>
          </>}
        </div>
      </section>
    </main>
  );
}

function formatReviewDate(date: string) {
  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime()) ? date : parsed.toISOString().slice(0, 10);
}

function completionLabel(status: State["completionResult"]) {
  if (status === "completed") return "Completed";
  if (status === "partial") return "Partial";
  if (status === "failed") return "Failed";
  return "Pending";
}

function predictionResultLabel(result: NonNullable<State["predictionResult"]>) {
  if (result === "happened") return "Yes";
  if (result === "partial") return "Partially";
  return "No";
}

function BrainSelector({ value, onChange }: { value: BrainMode; onChange: (provider: BrainMode) => void }) {
  return <div className="brain-selector" aria-label="Brain provider">{BRAIN_OPTIONS.map((option) => <button key={option.id} type="button" className={value === option.id ? "active" : ""} aria-pressed={value === option.id} onClick={() => onChange(option.id)}>{option.label}</button>)}</div>;
}

function BrainStatus({ output, lastUpdated, mode }: { output: BrainOutput; lastUpdated: string | null; mode: BrainMode }) {
  const meta = output.metadata;
  return <section className="brain-status" aria-label="Brain Status"><div><small>BRAIN STATUS</small><strong>{mode === "auto" ? "Auto · " : ""}{providerLabel(meta.provider)}</strong></div><dl><div><dt>Model</dt><dd>{meta.model}</dd></div><div><dt>Latency</dt><dd>{meta.latencyMs} ms</dd></div><div><dt>Fallback</dt><dd className={meta.fallback ? "fallback" : "healthy"}>{meta.fallback ? "Yes" : "No"}</dd></div><div><dt>Updated</dt><dd>{lastUpdated ? new Date(lastUpdated).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "—"}</dd></div></dl></section>;
}

function ComparisonView({ rules, openai }: { rules: BrainOutput; openai: BrainOutput }) {
  return <section className="brain-comparison"><div className="comparison-heading"><small>COMPARE MODE</small><strong>Rules vs OpenAI</strong></div><div className="comparison-grid"><ComparisonCard label="Rules" output={rules} /><ComparisonCard label={openai.metadata.fallback ? "OpenAI → Rules fallback" : "OpenAI"} output={openai} /></div></section>;
}

function ComparisonCard({ label, output }: { label: string; output: BrainOutput }) {
  return <article><span>{label}</span><strong>{output.score} · {output.outcome}</strong><p>{output.recommendation}</p><small>{output.todayDeliverable}</small></article>;
}

function BrainInspector({ trace, usage }: { trace: BrainTrace; usage: BrainUsage }) {
  return <details className="prompt-playground" open><summary>Brain Inspector</summary><div><section className="usage-monitor"><strong>Usage Monitor</strong><dl><div><dt>Total calls</dt><dd>{usage.totalCalls}</dd></div><div><dt>Tokens</dt><dd>{usage.totalTokens.toLocaleString()}</dd></div><div><dt>Estimated cost</dt><dd>${usage.estimatedCostUsd.toFixed(4)}</dd></div><div><dt>Fallbacks</dt><dd>{usage.fallbackCount}</dd></div></dl></section><PlaygroundValue label="Context" value={trace.context} /><PlaygroundValue label="Prompt" value={trace.prompt} /><PlaygroundValue label="Raw Response" value={trace.rawResponse} /><PlaygroundValue label="Parsed Output" value={trace.parsedOutput} /><PlaygroundValue label="Validation" value={trace.validation} /></div></details>;
}

function PlaygroundValue({ label, value }: { label: string; value: unknown }) {
  return <section><strong>{label}</strong><pre>{typeof value === "string" ? value : JSON.stringify(value, null, 2)}</pre></section>;
}

function addBrainUsage(current: BrainUsage | undefined, outputs: BrainOutput[]): BrainUsage {
  return outputs.reduce((usage, output) => {
    const tokens = output.metadata.tokenUsage;
    return {
      totalCalls: usage.totalCalls + 1,
      inputTokens: usage.inputTokens + (tokens?.inputTokens ?? 0),
      outputTokens: usage.outputTokens + (tokens?.outputTokens ?? 0),
      totalTokens: usage.totalTokens + (tokens?.totalTokens ?? 0),
      estimatedCostUsd: Number((usage.estimatedCostUsd + output.metadata.estimatedCostUsd).toFixed(6)),
      fallbackCount: usage.fallbackCount + (output.metadata.fallback ? 1 : 0),
    };
  }, current ?? emptyBrainUsage);
}

function providerLabel(provider: BrainProviderId) {
  if (provider === "openai") return "OpenAI";
  if (provider === "claude") return "Claude (mock)";
  if (provider === "gemini") return "Gemini (mock)";
  return "Rules";
}

function LibraryView({ title, kicker, empty, onBack, children }: { title: string; kicker: string; empty: string; onBack: () => void; children: React.ReactNode }) {
  const hasItems = Array.isArray(children) ? children.length > 0 : Boolean(children);
  return <section className="library" aria-labelledby="library-title">
    <button className="library-back" onClick={onBack}>← 返回 Today</button>
    <p className="kicker">{kicker}</p>
    <h2 id="library-title">{title}</h2>
    <div className="library-list">{hasItems ? children : <div className="empty-state"><span>◇</span><p>{empty}</p></div>}</div>
  </section>;
}

function DetailCard({ label, title, onBack, children }: { label: string; title: string; onBack: () => void; children: React.ReactNode }) {
  return <article className="detail-card">
    <button className="detail-back" onClick={onBack}>← 返回列表</button>
    <small>{label}</small><h3>{title}</h3>{children}
  </article>;
}

function ReviewDetail({ review, onBack }: { review: Review; onBack: () => void }) {
  return <DetailCard label={formatReviewDate(review.date)} title={review.action || "今日回顾"} onBack={onBack}>
    <span className="detail-label">Biggest Waste</span><p>{review.biggestWaste || "—"}</p>
    <span className="detail-label">Best Asset Created</span><p>{review.bestAsset || "—"}</p>
    <span className="detail-label">Tomorrow&apos;s One Focus</span><p>{review.tomorrowFocus || "—"}</p>
    <span className="detail-label">Prediction Result</span><p>{predictionResultLabel(review.predictionResult)}</p>
    <span className="detail-label">Wrong Assumption</span><p>{review.wrongAssumption || "—"}</p>
    <span className="detail-label">Next Time</span><p>{review.nextTimeChange || "—"}</p>
  </DetailCard>;
}

function WeeklyReportView({ report, onBack }: { report: WeeklyDecisionReport; onBack: () => void }) {
  return <section className="library weekly-report" aria-labelledby="weekly-report-title">
    <button className="library-back" onClick={onBack}>← 返回 Today</button>
    <p className="kicker">WEEKLY DECISION REPORT</p>
    <h2 id="weekly-report-title">本周，你是怎样做决定的？</h2>
    <div className="report-rates"><div><strong>{report.completionRate}%</strong><span>Completion rate</span></div><div><strong>{report.aiAdoptionRate}%</strong><span>AI adoption rate</span></div><div><strong>{report.decisionAccuracy}%</strong><span>Decision accuracy</span></div></div>
    <div className="report-grid">
      <ReportCard label="HIGHEST LEVERAGE WINS" title="最高杠杆胜利"><ol>{report.highestLeverageWins.length ? report.highestLeverageWins.map((entry) => <li key={entry.id}><strong>{entry.score}</strong><span>{entry.chosenAction}</span></li>) : <li>暂无已完成的决定</li>}</ol></ReportCard>
      <ReportCard label="MOST COMMON WASTE" title="最常见的浪费"><p>{report.mostCommonWaste}</p></ReportCard>
      <ReportCard label="REPEATED RISKS" title="反复出现的风险"><ul>{report.repeatedRisks.length ? report.repeatedRisks.map((risk) => <li key={risk}>{risk}</li>) : <li>本周暂未发现重复风险</li>}</ul></ReportCard>
      <ReportCard label="REPEATED FAILURES" title="反复失败"><ul>{report.repeatedFailures.length ? report.repeatedFailures.map((failure) => <li key={failure}>{failure}</li>) : <li>本周暂未发现重复失败</li>}</ul></ReportCard>
      <ReportCard label="NEXT WEEK" title="下周唯一建议"><p>{report.recommendation}</p></ReportCard>
    </div>
  </section>;
}

function ReportCard({ label, title, children }: { label: string; title: string; children: React.ReactNode }) {
  return <article className="report-card"><small>{label}</small><h3>{title}</h3>{children}</article>;
}
