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
  { id: "make-report", triggers: [{ event: "report/requested" }] },
  async ({ event, step }) => {
    const { id, topic } = event.data;

    // Stand-in for real slow work (an AI call, a big export).
    await step.sleep("do-the-slow-work", "8s");

    return step.run("build-report", () => {
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

export const functions = [sayHello, makeReport];
