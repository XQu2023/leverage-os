import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
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
