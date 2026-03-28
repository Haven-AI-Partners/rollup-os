import { db } from "@/lib/db";
import { gdriveApiErrors } from "@/lib/db/schema";
import { setOnRateLimitError } from "./rate-limit";

/**
 * Register the rate-limit error callback that persists errors to the DB.
 * Call once per task/request context with the current portcoId.
 */
export function registerGdriveErrorLogger(portcoId: string): void {
  setOnRateLimitError((context, status, attempt, exhausted) => {
    // Fire-and-forget DB insert — don't block the retry/throw flow
    db.insert(gdriveApiErrors)
      .values({ portcoId, httpStatus: status, context, attempt, exhausted })
      .catch((err: unknown) => {
        console.error("Failed to log GDrive API error to DB:", err);
      });
  });
}

/**
 * Unregister the callback (e.g. at task end to avoid stale portcoId references).
 */
export function unregisterGdriveErrorLogger(): void {
  setOnRateLimitError(null);
}
