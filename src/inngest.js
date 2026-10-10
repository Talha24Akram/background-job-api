import { Inngest } from "inngest";

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

export const functions = [sayHello];
