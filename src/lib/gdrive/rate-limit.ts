import { GDriveAuthError } from "./errors";

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

/**
 * HTTP status codes that trigger a retry.
 * 403 — Google returns "User rate limit exceeded" for per-user quota violations.
 * 429 — Standard "Too many requests" from backend rate checks.
 * 5xx — Transient server errors.
 */
const RETRYABLE_STATUS_CODES = new Set([403, 429, 500, 502, 503]);

/** Subset of status codes that indicate rate limiting specifically. */
const RATE_LIMIT_STATUS_CODES = new Set([403, 429]);

let lastCallTime = 0;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Optional callback invoked when a rate limit error is detected.
 * Set via `setOnRateLimitError()` to enable persistent error logging.
 */
let onRateLimitError: ((context: string, status: number, attempt: number, exhausted: boolean) => void) | null = null;

/**
 * Register a callback for rate limit events.
 * Called on every rate-limited retry attempt and when retries are exhausted.
 */
export function setOnRateLimitError(
  callback: ((context: string, status: number, attempt: number, exhausted: boolean) => void) | null,
): void {
  onRateLimitError = callback;
}

/**
 * Known OAuth error message substrings returned by Google's token endpoint.
 * These indicate the refresh token or client credentials are invalid — retrying is pointless.
 */
const AUTH_ERROR_MESSAGES = [
  "invalid_request",
  "invalid_grant",
  "invalid_client",
  "unauthorized_client",
  "invalid_token",
];

/** Check if an error is an OAuth/authentication failure that should not be retried. */
export function isAuthError(error: unknown): boolean {
  if (!(error && typeof error === "object")) return false;

  // Check error.message for OAuth error strings
  const message = (error as { message?: string }).message?.toLowerCase() ?? "";
  if (AUTH_ERROR_MESSAGES.some((msg) => message.includes(msg))) return true;

  // Check HTTP 401 status
  if ("response" in error) {
    const status = (error as { response?: { status?: number } }).response?.status;
    if (status === 401) return true;
  }

  // Check error.code (googleapis sometimes uses string codes)
  const code = (error as { code?: string | number }).code;
  if (code === 401 || code === "401") return true;

  return false;
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
 * - Retries on 403 (user rate limit), 429 (too many requests), and 5xx (transient) errors
 *   with exponential backoff.
 * - Logs warnings when rate limiting is detected.
 * - Invokes the registered `onRateLimitError` callback for observability.
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
      // Auth/OAuth errors are fatal — never retry
      if (isAuthError(error)) {
        const label = context ?? "unknown";
        console.error(
          `GDrive auth error [${label}]: ${error instanceof Error ? error.message : "unknown"}`,
        );
        throw new GDriveAuthError(
          `OAuth/auth failure during ${label}: ${error instanceof Error ? error.message : "unknown"}`,
          error,
        );
      }

      const { retryable, status } = isRetryableError(error);

      if (!retryable || attempt === MAX_RETRIES) {
        // Notify callback if this was a rate limit error that exhausted retries
        if (status && RATE_LIMIT_STATUS_CODES.has(status)) {
          const label = context ?? "unknown";
          console.error(
            `GDrive rate limit exhausted (HTTP ${status}) [${label}] — giving up after ${attempt + 1} attempts`,
          );
          onRateLimitError?.(label, status, attempt + 1, true);
        }
        throw error;
      }

      const label = context ? ` [${context}]` : "";
      const isRateLimit = RATE_LIMIT_STATUS_CODES.has(status!);

      console.warn(
        `GDrive ${isRateLimit ? "rate limited" : "transient error"} (HTTP ${status})${label} — retrying in ${backoff}ms (attempt ${attempt + 1}/${MAX_RETRIES})`,
      );

      if (isRateLimit) {
        onRateLimitError?.(context ?? "unknown", status!, attempt + 1, false);
      }

      await sleep(backoff);
      backoff = Math.min(backoff * BACKOFF_FACTOR, MAX_BACKOFF_MS);
    }
  }

  // Unreachable, but satisfies TypeScript
  throw new Error("withRateLimit: exhausted retries");
}
