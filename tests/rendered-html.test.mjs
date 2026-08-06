import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { decisionEngine } from "../lib/decision-engine.ts";

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
  assert.match(page, /useEffect\(\(\) => \{[\s\S]*window\.localStorage\.getItem/);
  assert.doesNotMatch(page, /useState\([^\n]*(?:new Date|Date\.now|Math\.random|toLocale)/);
});

test("implements Leave Behind with selectable AI asset suggestions", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");

  assert.match(page, /05 · LEAVE BEHIND/);
  assert.match(page, /客户跟进 SOP/);
  assert.match(page, /客户访谈 Prompt/);
  assert.match(page, /客户案例/);
  assert.match(page, /客户决策原则/);
  assert.match(page, /aria-pressed=\{selected\}/);
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
  assert.match(page, /保存并完成/);
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

  assert.match(page, /decisionEngine\(data\.goal, data\.action\)/);
  assert.match(page, /Follow AI/);
  assert.match(page, /Keep My Plan/);
  assert.match(page, /aiChoice: choice/);
  assert.match(page, /higherLeverageAlternative/);
  assert.doesNotMatch(page, /接受判断，继续/);
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
