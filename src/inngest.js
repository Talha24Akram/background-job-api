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

    // Stand-in for real slow work (an AI call, a big export).
    await step.sleep("do-the-slow-work", "8s");

    return step.run("build-report", () => {
      if (topic === "fail") throw new Error("The report oven is broken!");
      const result = {
        title: `Report on ${topic}`,
        summary: `Everything we know about ${topic}, compiled in the background.`,
        builtAt: new Date().toISOString(),
      };
      reports.set(id, { ...reports.get(id), status: "done", result });
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

export const functions = [sayHello, makeReport, heartbeat];
