import express from "express";
import { serve } from "inngest/express";
import { inngest, functions } from "./inngest.js";

const app = express();
app.use(express.json());

app.use("/api/inngest", serve({ client: inngest, functions }));

app.get("/health", (_req, res) => res.json({ status: "ok" }));

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => console.log(`API on http://localhost:${port}`));
