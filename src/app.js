import express from "express";
import { randomUUID } from "node:crypto";

// `send` hands an event to the job system (inngest.send in production, a fake in tests).
export function createApp({ send, reports }) {
  const app = express();
  app.use(express.json());

  app.get("/health", (_req, res) => res.json({ status: "ok" }));

  app.post("/reports", async (req, res) => {
    const topic = req.body?.topic;
    // Bad input is rejected at the door: no id, no event, no job, nothing to retry.
    if (typeof topic !== "string" || !topic.trim()) {
      return res.status(400).json({ error: "topic is required (non-empty string)" });
    }
    const id = randomUUID();
    reports.set(id, { id, topic, status: "pending", createdAt: new Date().toISOString() });
    // Hand the slow work to the background job and answer right away.
    await send({ name: "report/requested", data: { id, topic } });
    res.status(202).json({ id, status: "pending" });
  });

  // Control panel: every report and its status.
  app.get("/reports", (_req, res) => res.json([...reports.values()]));

  app.get("/reports/:id", (req, res) => {
    const report = reports.get(req.params.id);
    if (!report) return res.status(404).json({ error: "report not found" });
    res.json(report);
  });

  return app;
}
