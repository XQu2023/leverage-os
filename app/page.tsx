"use client";

import { useEffect, useMemo, useState } from "react";

type Review = {
  date: string;
  action: string;
  biggestWaste: string;
  bestAsset: string;
  tomorrowFocus: string;
  multiplier: string;
};

type View = "today" | "assets" | "reviews";

type State = {
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
};

const initialState: State = {
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
};

const STORAGE_KEY = "leverage-os-v1";

function judgeAction(goal: string, action: string) {
  const text = action.toLowerCase();
  const concrete = /发布|完成|联系|访谈|销售|交付|测试|签约|launch|ship|call|sell|publish/.test(text);
  const vague = /研究|看看|学习|整理|想想|research|learn|explore/.test(text);
  const aligned = goal && action && goal.split(/[，。,.\s]/).filter((w) => w.length > 1).some((w) => action.includes(w));
  const score = Math.min(96, 58 + (concrete ? 19 : 7) + (aligned ? 13 : 5) - (vague ? 12 : 0));
  return {
    score,
    verdict: score >= 78 ? "高杠杆行动" : score >= 65 ? "方向正确，需要收窄" : "先让行动更具体",
    reason: concrete
      ? "它会产生可验证的外部结果，而不只是内部准备。"
      : "它与年度目标相关，但最好明确一个今天能交付的结果。",
  };
}

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

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<State>;
        const assets = suggestAssets(parsed.action ?? "");
        const selectedAssets = (parsed.selectedAssets ?? []).filter((asset) => assets.includes(asset));
        setData({ ...initialState, ...parsed, assets, selectedAssets: selectedAssets.length ? selectedAssets : [assets[0]] });
      }
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (hydrated) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [data, hydrated]);

  const judgment = useMemo(() => judgeAction(data.goal, data.action), [data.goal, data.action]);
  const today = hydrated
    ? new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric", weekday: "long" }).format(new Date())
    : "今天";
  const progress = Math.round(((step - 1) / 5) * 100);
  const update = (patch: Partial<State>) => setData((current) => ({ ...current, ...patch }));

  function goToStep(nextStep: number) {
    if (nextStep === 5 && data.assets.length !== 4) {
      const assets = suggestAssets(data.action);
      update({ assets, selectedAssets: [assets[0]] });
    }
    setStep(nextStep);
  }

  function next() {
    if (step === 2 && !data.multiplier) update({ multiplier: suggestMultiplier(data.action) });
    goToStep(Math.min(6, step + 1));
  }

  function saveReview() {
    if (!data.biggestWaste.trim() || !data.bestAsset.trim() || !data.tomorrowFocus.trim()) return;
    const review = { date: new Date().toISOString(), action: data.action, biggestWaste: data.biggestWaste, bestAsset: data.bestAsset, tomorrowFocus: data.tomorrowFocus, multiplier: data.multiplier };
    update({ reviews: [review, ...data.reviews], completed: true });
  }

  const canContinue = step === 1 ? data.goal.trim().length > 8 : step === 2 ? data.action.trim().length > 5 : true;
  const openToday = () => {
    setView("today");
    setSelectedAsset(null);
    setSelectedReview(null);
  };

  function openAssets() {
    setView("assets");
    setSelectedAsset(null);
  }

  function openReviews() {
    setView("reviews");
    setSelectedReview(null);
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark">L</span><span>Leverage OS</span></div>
        <nav aria-label="主要导航">
          <button className={`nav-item ${view === "today" ? "active" : ""}`} onClick={openToday}><span>◆</span> Today</button>
          <button className="nav-item" onClick={() => { openToday(); setStep(1); }}><span>↗</span> One-Year Goal</button>
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
              <textarea className="hero-input" value={data.action} onChange={(e) => update({ action: e.target.value })} placeholder="写下一个今天可以完成、会产生真实结果的行动…" autoFocus />
              <div className="constraint"><span>1</span><p><strong>只选一个</strong><br />不是待办清单，而是今天最重要的下注。</p></div>
            </>}

            {step === 3 && <>
              <p className="kicker">03 · AI JUDGMENT</p>
              <h2>这个行动值得你投入今天吗？</h2>
              <div className="judgment-card">
                <div className="score-ring" style={{ "--score": `${judgment.score * 3.6}deg` } as React.CSSProperties}><span>{judgment.score}</span><small>/ 100</small></div>
                <div><span className="verdict">{judgment.verdict}</span><h3>{data.action}</h3><p>{judgment.reason}</p></div>
              </div>
              <div className="criteria"><div><span>✓</span><p><strong>目标对齐</strong><br />直接服务于一年目标</p></div><div><span>✓</span><p><strong>结果导向</strong><br />今天可以验证进展</p></div><div><span>↑</span><p><strong>杠杆潜力</strong><br />能为未来创造复利</p></div></div>
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
                {data.assets.map((asset, i) => { const selected = data.selectedAssets.includes(asset); return <button key={asset} aria-pressed={selected} className={selected ? "asset selected" : "asset"} onClick={() => update({ selectedAssets: selected ? data.selectedAssets.filter((x) => x !== asset) : [...data.selectedAssets, asset] })}><span>{["▤", "◇", "◎", "◆"][i]}</span><div><strong>{asset}</strong><small>{selected ? "已选择 · 将保存为今日资产" : "AI 建议 · 点击选择"}</small></div><i>{selected ? "✓" : "+"}</i></button>; })}
              </div>
              <p className="selection-status">已选择 {data.selectedAssets.length} 项资产</p>
              <div className="multiplier-note"><span>今日乘数</span>{data.multiplier}</div>
            </>}

            {step === 6 && <>
              <p className="kicker">06 · DAILY REVIEW</p>
              <h2>{data.completed ? "今天的复利已经开始。" : "用三个答案，结束今天。"}</h2>
              {data.completed ? <div className="completion">
                <div className="completion-mark">✓</div><h3>Daily review saved</h3><p>你完成了今天的最高杠杆行动，并留下 {data.selectedAssets.length} 项可复用资产。</p>
                <div className="summary-row"><span>行动</span><strong>{data.action}</strong></div><div className="summary-row"><span>乘数</span><strong>{data.multiplier}</strong></div>
                <button className="secondary" onClick={() => { update({ action: "", multiplier: "", completed: false, assets: [], selectedAssets: [], biggestWaste: "", bestAsset: "", tomorrowFocus: "" }); setStep(2); }}>开始新的一天 →</button>
              </div> : <div className="review-form">
                <label><span>Biggest Waste</span><strong>今天最大的浪费是什么？</strong><textarea value={data.biggestWaste} onChange={(e) => update({ biggestWaste: e.target.value })} placeholder="以后可以删除、委派或自动化什么？" /></label>
                <label><span>Best Asset Created</span><strong>今天留下的最佳资产是什么？</strong><textarea value={data.bestAsset} onChange={(e) => update({ bestAsset: e.target.value })} placeholder="SOP、Prompt、案例或决策原则…" /></label>
                <label><span>Tomorrow&apos;s One Focus</span><strong>明天唯一的重点是什么？</strong><textarea value={data.tomorrowFocus} onChange={(e) => update({ tomorrowFocus: e.target.value })} placeholder="只写一个最值得推进的结果…" /></label>
              </div>}
            </>}

            {!data.completed && <div className="actions">
              {step > 1 && <button className="back" onClick={() => setStep(step - 1)}>← 返回</button>}
              <button className="primary" disabled={!canContinue || (step === 5 && data.selectedAssets.length === 0) || (step === 6 && (!data.biggestWaste.trim() || !data.bestAsset.trim() || !data.tomorrowFocus.trim()))} onClick={step === 6 ? saveReview : next}>{step === 6 ? "保存并完成" : step === 5 ? "保存资产并继续" : step === 3 ? "接受判断，继续" : "继续"}<span>→</span></button>
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
  </DetailCard>;
}
