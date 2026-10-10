import { serve } from "inngest/express";
import { createApp } from "./app.js";
import { inngest, functions } from "./inngest.js";
import { reports } from "./store.js";

const app = createApp({ send: (event) => inngest.send(event), reports });
app.use("/api/inngest", serve({ client: inngest, functions }));

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => console.log(`API on http://localhost:${port}`));
