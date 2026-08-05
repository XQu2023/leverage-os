"use client";

import { useEffect, useMemo, useState } from "react";

type Review = {
  date: string;
  action: string;
  win: string;
  lesson: string;
  multiplier: string;
};

type State = {
  goal: string;
  action: string;
  multiplier: string;
  completed: boolean;
  assets: string[];
  selectedAssets: string[];
  win: string;
  lesson: string;
  reviews: Review[];
};

const initialState: State = {
  goal: "",
  action: "",
  multiplier: "",
  completed: false,
  assets: [],
  selectedAssets: [],
  win: "",
  lesson: "",
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
  if (/客户|销售|联系|访谈|用户/.test(action)) return ["客户洞察记录", "跟进话术模板", "常见异议清单"];
  if (/内容|发布|文章|视频|写/.test(action)) return ["内容模板", "发布检查清单", "可复用素材库"];
  if (/产品|开发|功能|上线|测试/.test(action)) return ["产品决策记录", "发布检查清单", "用户反馈模板"];
  return ["执行检查清单", "可复用工作模板", "关键决策记录"];
}

export default function Home() {
  const [data, setData] = useState<State>(initialState);
  const [hydrated, setHydrated] = useState(false);
  const [step, setStep] = useState(1);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) setData({ ...initialState, ...JSON.parse(saved) });
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

  function next() {
    if (step === 2 && !data.multiplier) update({ multiplier: suggestMultiplier(data.action) });
    if (step === 4 && data.assets.length === 0) {
      const assets = suggestAssets(data.action);
      update({ assets, selectedAssets: [assets[0]] });
    }
    setStep((current) => Math.min(6, current + 1));
  }

  function saveReview() {
    if (!data.win.trim() || !data.lesson.trim()) return;
    const review = { date: new Date().toISOString(), action: data.action, win: data.win, lesson: data.lesson, multiplier: data.multiplier };
    update({ reviews: [review, ...data.reviews], completed: true });
  }

  const canContinue = step === 1 ? data.goal.trim().length > 8 : step === 2 ? data.action.trim().length > 5 : true;

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark">L</span><span>Leverage OS</span></div>
        <nav aria-label="主要导航">
          <button className="nav-item active"><span>◆</span> Today</button>
          <button className="nav-item" onClick={() => setStep(1)}><span>↗</span> One-Year Goal</button>
          <div className="nav-spacer" />
          <p className="nav-label">YOUR SYSTEM</p>
          <div className="system-stat"><span>留下的资产</span><strong>{data.selectedAssets.length}</strong></div>
          <div className="system-stat"><span>完成的日回顾</span><strong>{data.reviews.length}</strong></div>
        </nav>
        <div className="sidebar-foot"><div className="avatar">YO</div><div><strong>Your OS</strong><small>本地私人空间</small></div></div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div><span className="eyebrow">TODAY</span><h1>{today}</h1></div>
          <div className="progress-wrap"><span>{progress}% complete</span><div className="progress"><i style={{ width: `${progress}%` }} /></div></div>
        </header>

        <div className="content">
          <div className="stepper" aria-label="今日流程">
            {["年度目标", "最高杠杆", "AI 判断", "今日乘数", "留下资产", "日回顾"].map((label, index) => (
              <button key={label} className={step === index + 1 ? "current" : step > index + 1 ? "done" : ""} onClick={() => step > index + 1 && setStep(index + 1)}>
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
                {data.assets.map((asset, i) => { const selected = data.selectedAssets.includes(asset); return <button key={asset} className={selected ? "asset selected" : "asset"} onClick={() => update({ selectedAssets: selected ? data.selectedAssets.filter((x) => x !== asset) : [...data.selectedAssets, asset] })}><span>{["▤", "◇", "◎"][i]}</span><div><strong>{asset}</strong><small>{selected ? "已加入今日成果" : "点击选择"}</small></div><i>{selected ? "✓" : "+"}</i></button>; })}
              </div>
              <div className="multiplier-note"><span>今日乘数</span>{data.multiplier}</div>
            </>}

            {step === 6 && <>
              <p className="kicker">06 · DAILY REVIEW</p>
              <h2>{data.completed ? "今天的复利已经开始。" : "用两句话，结束今天。"}</h2>
              {data.completed ? <div className="completion">
                <div className="completion-mark">✓</div><h3>Daily review saved</h3><p>你完成了今天的最高杠杆行动，并留下 {data.selectedAssets.length} 项可复用资产。</p>
                <div className="summary-row"><span>行动</span><strong>{data.action}</strong></div><div className="summary-row"><span>乘数</span><strong>{data.multiplier}</strong></div>
                <button className="secondary" onClick={() => { update({ action: "", multiplier: "", completed: false, assets: [], selectedAssets: [], win: "", lesson: "" }); setStep(2); }}>开始新的一天 →</button>
              </div> : <div className="review-form">
                <label>今天真正推进了什么？<textarea value={data.win} onChange={(e) => update({ win: e.target.value })} placeholder="记录结果，而不是投入的时间…" /></label>
                <label>明天需要记住什么？<textarea value={data.lesson} onChange={(e) => update({ lesson: e.target.value })} placeholder="一个判断、教训或下一步…" /></label>
              </div>}
            </>}

            {!data.completed && <div className="actions">
              {step > 1 && <button className="back" onClick={() => setStep(step - 1)}>← 返回</button>}
              <button className="primary" disabled={!canContinue || (step === 6 && (!data.win.trim() || !data.lesson.trim()))} onClick={step === 6 ? saveReview : next}>{step === 6 ? "完成今日回顾" : step === 3 ? "接受判断，继续" : "继续"}<span>→</span></button>
            </div>}
          </div>
        </div>
      </section>
    </main>
  );
}
