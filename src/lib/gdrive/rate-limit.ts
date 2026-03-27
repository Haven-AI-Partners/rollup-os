/** Throttle delay between consecutive Google Drive API calls (ms). */
const THROTTLE_DELAY_MS = 100;

/** Maximum number of retry attempts for rate-limited or transient errors. */
const MAX_RETRIES = 5;

/** Initial backoff duration after a rate-limit error (ms). */
const INITIAL_BACKOFF_MS = 1_000;

/** Maximum backoff duration cap (ms). */
const MAX_BACKOFF_MS = 30_000;

/** Exponential backoff multiplier. */
const BACKOFF_FACTOR = 2;

/** HTTP status codes that trigger a retry. */
const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503]);

let lastCallTime = 0;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Check if an error is a Google API error with a retryable status code. */
function isRetryableError(error: unknown): { retryable: boolean; status?: number } {
  if (error && typeof error === "object" && "response" in error) {
    const resp = (error as { response?: { status?: number } }).response;
    const status = resp?.status;
    if (status && RETRYABLE_STATUS_CODES.has(status)) {
      return { retryable: true, status };
    }
  }
  return { retryable: false };
}

/**
 * Execute a Google Drive API call with throttling and retry logic.
 *
 * - Enforces a minimum delay between consecutive calls to avoid bursting.
 * - Retries on 429 (rate limit) and 5xx (transient) errors with exponential backoff.
 * - Logs warnings when rate limiting is detected.
 *
 * @param fn - The async function that makes the API call
 * @param context - Optional label for log messages (e.g. "files.list folder=xyz")
 */
export async function withRateLimit<T>(
  fn: () => Promise<T>,
  context?: string,
): Promise<T> {
  // Throttle: wait if we called too recently
  const now = Date.now();
  const elapsed = now - lastCallTime;
  if (elapsed < THROTTLE_DELAY_MS) {
    await sleep(THROTTLE_DELAY_MS - elapsed);
  }

  let backoff = INITIAL_BACKOFF_MS;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      lastCallTime = Date.now();
      return await fn();
    } catch (error) {
      const { retryable, status } = isRetryableError(error);

      if (!retryable || attempt === MAX_RETRIES) {
        throw error;
      }

      const label = context ? ` [${context}]` : "";
      console.warn(
        `GDrive rate limited (HTTP ${status})${label} — retrying in ${backoff}ms (attempt ${attempt + 1}/${MAX_RETRIES})`,
      );

      await sleep(backoff);
      backoff = Math.min(backoff * BACKOFF_FACTOR, MAX_BACKOFF_MS);
    }
  }

  // Unreachable, but satisfies TypeScript
  throw new Error("withRateLimit: exhausted retries");
}
