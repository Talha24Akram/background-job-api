import test from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../src/app.js";

async function start() {
  const sent = [];
  const reports = new Map();
  const app = createApp({ send: async (e) => void sent.push(e), reports });
  const server = await new Promise((r) => { const s = app.listen(0, () => r(s)); });
  const base = `http://localhost:${server.address().port}`;
  const post = (body) =>
    fetch(`${base}/reports`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  return { base, post, sent, reports, close: () => server.close() };
}

test("POST /reports answers 202 with an id and sends one event", async () => {
  const t = await start();
  const res = await t.post({ topic: "cats" });
  const body = await res.json();
  assert.equal(res.status, 202);
  assert.equal(body.status, "pending");
  assert.equal(t.sent.length, 1);
  assert.equal(t.sent[0].name, "report/requested");
  assert.deepEqual(t.sent[0].data, { id: body.id, topic: "cats" });
  t.close();
});

test("missing / empty / non-string topic -> 400 and no event", async () => {
  const t = await start();
  for (const body of [{}, { topic: "" }, { topic: "   " }, { topic: 5 }]) {
    assert.equal((await t.post(body)).status, 400);
  }
  const bad = await fetch(`${t.base}/reports`, { method: "POST", headers: { "content-type": "application/json" }, body: "{oops" });
  assert.equal(bad.status, 400);
  assert.equal(t.sent.length, 0);
  assert.equal(t.reports.size, 0);
  t.close();
});

test("GET /reports/:id: pending, then done; unknown id -> 404", async () => {
  const t = await start();
  const { id } = await (await t.post({ topic: "cats" })).json();
  assert.equal((await (await fetch(`${t.base}/reports/${id}`)).json()).status, "pending");
  t.reports.set(id, { ...t.reports.get(id), status: "done", result: { title: "x" } });
  const done = await (await fetch(`${t.base}/reports/${id}`)).json();
  assert.equal(done.status, "done");
  assert.equal(done.result.title, "x");
  assert.equal((await fetch(`${t.base}/reports/nope`)).status, 404);
  t.close();
});

test("GET /reports lists everything", async () => {
  const t = await start();
  await t.post({ topic: "a" });
  await t.post({ topic: "b" });
  const list = await (await fetch(`${t.base}/reports`)).json();
  assert.deepEqual(list.map((r) => r.topic).sort(), ["a", "b"]);
  t.close();
});
