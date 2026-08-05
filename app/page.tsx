"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Lane = "delete" | "delegate" | "automate" | "do";
type Task = { id: string; text: string; lane: Lane };
type Asset = { id: string; text: string; type: string };
type Review = { date: string; win: string; lesson: string; tomorrow: string };
type Store = {
  goal: string;
  action: string;
  actionDone: boolean;
  tasks: Task[];
  assets: Asset[];
  reviews: Review[];
};

const initial: Store = {
  goal: "Build a profitable product that runs without my daily involvement",
  action: "Speak to 3 target users and validate the highest-cost problem",
  actionDone: false,
  tasks: [
    { id: "1", text: "Rewrite the weekly status deck", lane: "delete" },
    { id: "2", text: "Book customer interviews", lane: "delegate" },
    { id: "3", text: "Send follow-up emails", lane: "automate" },
    { id: "4", text: "Run customer interviews", lane: "do" },
  ],
  assets: [
    { id: "1", text: "Customer interview script", type: "Template" },
    { id: "2", text: "Problem validation notes", type: "Data" },
  ],
  reviews: [],
};

const lanes: { key: Lane; label: string; hint: string; icon: string }[] = [
  { key: "delete", label: "Delete", hint: "No meaningful return", icon: "×" },
  { key: "delegate", label: "Delegate", hint: "Someone else can own it", icon: "↗" },
  { key: "automate", label: "Automate", hint: "A system can repeat it", icon: "⌁" },
  { key: "do", label: "Do", hint: "Only you can do it", icon: "✓" },
];

const todayLabel = new Intl.DateTimeFormat("en-GB", {
  weekday: "long",
  day: "numeric",
  month: "long",
}).format(new Date());

export default function Home() {
  const [data, setData] = useState<Store>(initial);
  const [ready, setReady] = useState(false);
  const [taskText, setTaskText] = useState("");
  const [assetText, setAssetText] = useState("");
  const [assetType, setAssetType] = useState("System");
  const [reviewOpen, setReviewOpen] = useState(false);
  const [goalEditing, setGoalEditing] = useState(false);
  const [actionEditing, setActionEditing] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem("leverage-os-v1");
    if (saved) {
      try { setData(JSON.parse(saved)); } catch { /* keep starter state */ }
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (ready) window.localStorage.setItem("leverage-os-v1", JSON.stringify(data));
  }, [data, ready]);

  const today = new Date().toISOString().slice(0, 10);
  const reviewedToday = useMemo(() => data.reviews.some((r) => r.date === today), [data.reviews, today]);

  function update(patch: Partial<Store>) { setData((d) => ({ ...d, ...patch })); }

  function addTask(e: FormEvent) {
    e.preventDefault();
    if (!taskText.trim()) return;
    update({ tasks: [...data.tasks, { id: crypto.randomUUID(), text: taskText.trim(), lane: "do" }] });
    setTaskText("");
  }

  function moveTask(id: string, lane: Lane) {
    update({ tasks: data.tasks.map((t) => t.id === id ? { ...t, lane } : t) });
  }

  function addAsset(e: FormEvent) {
    e.preventDefault();
    if (!assetText.trim()) return;
    update({ assets: [{ id: crypto.randomUUID(), text: assetText.trim(), type: assetType }, ...data.assets] });
    setAssetText("");
  }

  function saveReview(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const next: Review = {
      date: today,
      win: String(form.get("win") || ""),
      lesson: String(form.get("lesson") || ""),
      tomorrow: String(form.get("tomorrow") || ""),
    };
    update({ reviews: [...data.reviews.filter((r) => r.date !== today), next] });
    setReviewOpen(false);
  }

  if (!ready) return null;

  return (
    <main className="shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Leverage OS home"><span className="mark">L</span> Leverage OS</a>
        <div className="date"><span className="live-dot" /> {todayLabel}</div>
      </header>

      <section className="hero" id="top">
        <div className="goal-label"><span>01</span> ONE-YEAR OUTCOME</div>
        {goalEditing ? (
          <input className="goal-input" autoFocus value={data.goal} onChange={(e) => update({ goal: e.target.value })} onBlur={() => setGoalEditing(false)} onKeyDown={(e) => e.key === "Enter" && setGoalEditing(false)} />
        ) : (
          <button className="goal" onClick={() => setGoalEditing(true)}>{data.goal}<span className="edit">Edit</span></button>
        )}
        <p className="goal-note">Everything below should make this outcome more likely.</p>
      </section>

      <section className="focus-card">
        <div className="focus-top">
          <div>
            <div className="eyebrow"><span>02</span> TODAY&apos;S HIGHEST-LEVERAGE ACTION</div>
            <p>One move that changes the trajectory.</p>
          </div>
          <div className={`status ${data.actionDone ? "done" : ""}`}>{data.actionDone ? "COMPLETED" : "IN FOCUS"}</div>
        </div>
        <div className="action-row">
          <button className={`check ${data.actionDone ? "checked" : ""}`} onClick={() => update({ actionDone: !data.actionDone })} aria-label="Mark focus action complete">{data.actionDone ? "✓" : ""}</button>
          {actionEditing ? (
            <input className="action-input" autoFocus value={data.action} onChange={(e) => update({ action: e.target.value })} onBlur={() => setActionEditing(false)} onKeyDown={(e) => e.key === "Enter" && setActionEditing(false)} />
          ) : (
            <button className={`action-text ${data.actionDone ? "strike" : ""}`} onClick={() => setActionEditing(true)}>{data.action}</button>
          )}
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <div><div className="eyebrow"><span>03</span> TRIAGE EVERYTHING ELSE</div><h2>Protect your time.</h2></div>
          <form className="quick-add" onSubmit={addTask}><input value={taskText} onChange={(e) => setTaskText(e.target.value)} placeholder="Add a task…" aria-label="New task" /><button>+</button></form>
        </div>
        <div className="lane-grid">
          {lanes.map((lane) => (
            <div className={`lane lane-${lane.key}`} key={lane.key}>
              <div className="lane-head"><span className="lane-icon">{lane.icon}</span><div><h3>{lane.label}</h3><p>{lane.hint}</p></div><b>{data.tasks.filter((t) => t.lane === lane.key).length}</b></div>
              <div className="task-list">
                {data.tasks.filter((t) => t.lane === lane.key).map((task) => (
                  <div className="task" key={task.id}>
                    <span>{task.text}</span>
                    <select value={task.lane} onChange={(e) => moveTask(task.id, e.target.value as Lane)} aria-label={`Classify ${task.text}`}>
                      {lanes.map((x) => <option value={x.key} key={x.key}>{x.label}</option>)}
                    </select>
                  </div>
                ))}
                {!data.tasks.some((t) => t.lane === lane.key) && <div className="empty">Nothing here</div>}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="bottom-grid">
        <div className="asset-card">
          <div className="eyebrow"><span>04</span> ASSETS CREATED</div>
          <h2>Make today pay tomorrow.</h2>
          <form className="asset-form" onSubmit={addAsset}>
            <input value={assetText} onChange={(e) => setAssetText(e.target.value)} placeholder="What did you create?" aria-label="Asset created" />
            <select value={assetType} onChange={(e) => setAssetType(e.target.value)} aria-label="Asset type">
              {['System','Template','Content','Data','Relationship','Prompt'].map((x) => <option key={x}>{x}</option>)}
            </select>
            <button>Add</button>
          </form>
          <div className="assets">
            {data.assets.slice(0, 4).map((asset) => <div className="asset" key={asset.id}><span className="asset-glyph">◇</span><span>{asset.text}</span><b>{asset.type}</b></div>)}
          </div>
        </div>

        <div className="review-card">
          <div className="eyebrow"><span>05</span> DAILY REVIEW</div>
          <h2>{reviewedToday ? "Day closed." : "Close the loop."}</h2>
          <p>{reviewedToday ? "Your learning is captured. Return tomorrow and compound it." : "Three questions. Five minutes. Keep what works and correct what doesn’t."}</p>
          <button className="review-button" onClick={() => setReviewOpen(true)}>{reviewedToday ? "Edit today’s review" : "Start daily review"}<span>→</span></button>
          <div className="streak"><span>● ● ● ● ●</span> {Math.max(1, data.reviews.length)} day review streak</div>
        </div>
      </section>

      <footer><span>ONE GOAL · ONE LEVER · DAILY COMPOUNDING</span><span>Saved on this device</span></footer>

      {reviewOpen && <div className="modal-backdrop" onMouseDown={() => setReviewOpen(false)}>
        <form className="modal" onSubmit={saveReview} onMouseDown={(e) => e.stopPropagation()}>
          <button type="button" className="modal-close" onClick={() => setReviewOpen(false)}>×</button>
          <div className="eyebrow"><span>05</span> DAILY REVIEW</div>
          <h2>Close the loop.</h2>
          <label>What moved the goal forward?<textarea name="win" required placeholder="The action that mattered…" /></label>
          <label>What should you stop or change?<textarea name="lesson" required placeholder="The lesson to keep…" /></label>
          <label>What is tomorrow’s highest-leverage action?<textarea name="tomorrow" required placeholder="One decisive move…" /></label>
          <button className="save-review">Save review</button>
        </form>
      </div>}
    </main>
  );
}
