import { mkdirSync, writeFileSync } from "node:fs";
import { Inngest } from "inngest";
import { reports } from "./store.js";

// Local Dev Server only: no event/signing keys needed. Production would set
// NODE_ENV=production plus INNGEST_EVENT_KEY / INNGEST_SIGNING_KEY.
export const inngest = new Inngest({
  id: "report-api",
  isDev: process.env.NODE_ENV !== "production",
});

export const sayHello = inngest.createFunction(
  { id: "say-hello", triggers: [{ event: "test/hello" }] },
  async ({ step }) => {
    await step.sleep("wait-five-seconds", "5s");
    return "Hello from the background!";
  },
);

export const makeReport = inngest.createFunction(
  {
    id: "make-report",
    retries: 2, // 1 first attempt + 2 retries = 3 attempts, then the run is Failed
    idempotency: "event.data.id", // the same report id twice = one run
    triggers: [{ event: "report/requested" }],
    // Runs once, after the last retry has failed: record it so the status
    // endpoint (and the heartbeat) can tell the client the job gave up.
    onFailure: async ({ event, error }) => {
      const { id } = event.data.event.data;
      reports.set(id, { ...reports.get(id), status: "failed", error: error.message });
    },
  },
  async ({ event, step }) => {
    const { id, topic } = event.data;

    // Step 1: gather the facts. A finished step is saved by Inngest, so it is
    // NOT executed again if the server restarts during the sleep below.
    const facts = await step.run("collect-data", () => {
      console.log(`collect-data executed for ${id}`);
      return { topic, words: topic.trim().split(/\s+/).length, collectedAt: new Date().toISOString() };
    });

    // Step 2: stand-in for real slow work (an AI call, a big export).
    await step.sleep("do-the-slow-work", "8s");

    // Step 3: build the result and save it.
    return step.run("build-report", () => {
      if (topic === "fail") throw new Error("The report oven is broken!");
      // Idempotent: if this report is already done, running again changes nothing.
      const existing = reports.get(id);
      if (existing?.status === "done") return existing.result;

      const result = {
        title: `Report on ${topic}`,
        summary: `Everything we know about ${topic}, compiled in the background.`,
        facts,
        builtAt: new Date().toISOString(),
      };
      // Upsert: keeps working even if the server restarted and lost its memory.
      reports.set(id, { ...existing, id, topic, status: "done", result, finishedAt: result.builtAt });

      // The "email": a file in outbox/ standing in for a message sent by a job.
      mkdirSync("outbox", { recursive: true });
      writeFileSync(`outbox/${id}.txt`, `${result.title}\n\n${result.summary}\n`);
      console.log(`build-report executed for ${id}`);
      return result;
    });
  },
);

// Cron job: nobody sends an event, the clock is the only trigger.
// "* * * * *" = every minute (testing only; a real one would run daily).
export const heartbeat = inngest.createFunction(
  { id: "heartbeat", triggers: [{ cron: "* * * * *" }] },
  async ({ step }) => {
    return step.run("count-reports", () => {
      const counts = { pending: 0, done: 0, failed: 0 };
      for (const { status } of reports.values()) counts[status] += 1;
      const line = `heartbeat: ${counts.pending} pending, ${counts.done} done, ${counts.failed} failed`;
      console.log(line);
      return line;
    });
  },
);

// Second cron job, taking out the trash: delete done reports older than 10 minutes.
export const cleanup = inngest.createFunction(
  { id: "cleanup", triggers: [{ cron: "*/5 * * * *" }] },
  async ({ step }) => {
    return step.run("delete-old-reports", () => {
      const cutoff = Date.now() - 10 * 60 * 1000;
      let deleted = 0;
      for (const [id, r] of reports) {
        if (r.status === "done" && Date.parse(r.finishedAt) < cutoff) {
          reports.delete(id);
          deleted += 1;
        }
      }
      console.log(`cleanup: deleted ${deleted} old reports`);
      return { deleted };
    });
  },
);

export const functions = [sayHello, makeReport, heartbeat, cleanup];
