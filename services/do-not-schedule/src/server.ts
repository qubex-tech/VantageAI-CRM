import express, { type Request, type Response } from "express";
import { Retell } from "retell-sdk";

import { isOnDoNotScheduleList } from "./match";

const app = express();

// Retell signs the *raw* request body, so we must verify against the exact
// bytes we received — never a re-serialized JSON object.
app.use(express.raw({ type: "application/json" }));

interface RetellCustomFunctionBody {
  name?: string;
  call?: unknown;
  args?: {
    first_name?: unknown;
    last_name?: unknown;
    date_of_birth?: unknown;
  };
}

app.post("/check-do-not-schedule", (req: Request, res: Response) => {
  const apiKey = process.env.RETELL_API_KEY;
  if (!apiKey) {
    // Misconfiguration on our side — refuse rather than skipping verification.
    console.error("[check-do-not-schedule] RETELL_API_KEY is not set");
    return res.status(401).json({ on_do_not_schedule_list: false });
  }

  const rawBody = Buffer.isBuffer(req.body)
    ? req.body.toString("utf-8")
    : typeof req.body === "string"
      ? req.body
      : "";

  const signature = req.headers["x-retell-signature"];
  if (
    typeof signature !== "string" ||
    !Retell.verify(rawBody, apiKey, signature)
  ) {
    console.error("[check-do-not-schedule] Invalid Retell signature");
    return res.status(401).json({ on_do_not_schedule_list: false });
  }

  let body: RetellCustomFunctionBody;
  try {
    body = JSON.parse(rawBody) as RetellCustomFunctionBody;
  } catch {
    // Fail open: a malformed body should not block scheduling.
    console.warn("[check-do-not-schedule] Could not parse request body as JSON");
    return res.status(200).json({ on_do_not_schedule_list: false });
  }

  const args = body.args;
  const hasRequiredFields =
    !!args &&
    typeof args.first_name === "string" &&
    args.first_name.trim().length > 0 &&
    typeof args.last_name === "string" &&
    args.last_name.trim().length > 0;

  if (!hasRequiredFields) {
    // Fail open so a bad/incomplete request never blocks scheduling, but flag
    // it. Note: we intentionally do NOT log the args themselves (PII).
    console.warn(
      "[check-do-not-schedule] Missing required args (first_name/last_name); failing open",
    );
    return res.status(200).json({ on_do_not_schedule_list: false });
  }

  const onList = isOnDoNotScheduleList({
    firstName: args!.first_name,
    lastName: args!.last_name,
    dateOfBirth: args!.date_of_birth,
  });

  // Log only the boolean outcome — never the caller's name or DOB.
  console.log(`[check-do-not-schedule] lookup complete on_list=${onList}`);

  return res.status(200).json({ on_do_not_schedule_list: onList });
});

// Lightweight health check for load balancers / uptime monitors.
app.get("/healthz", (_req: Request, res: Response) => {
  res.status(200).json({ status: "ok" });
});

const port = Number(process.env.PORT) || 3000;
app.listen(port, () => {
  console.log(`do-not-schedule-lookup listening on port ${port}`);
});

export { app };
