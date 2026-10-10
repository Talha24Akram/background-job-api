import express from "express";
import { serve } from "inngest/express";
import { randomUUID } from "node:crypto";
import { inngest, functions } from "./inngest.js";
import { reports } from "./store.js";

const app = express();
app.use(express.json());

app.use("/api/inngest", serve({ client: inngest, functions }));

app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.post("/reports", async (req, res) => {
  const { topic } = req.body;
  const id = randomUUID();
  reports.set(id, { id, topic, status: "pending" });
  // Hand the slow work to the background job and answer right away.
  await inngest.send({ name: "report/requested", data: { id, topic } });
  res.status(202).json({ id, status: "pending" });
});

app.get("/reports/:id", (req, res) => {
  const report = reports.get(req.params.id);
  if (!report) return res.status(404).json({ error: "report not found" });
  res.json(report);
});

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => console.log(`API on http://localhost:${port}`));
