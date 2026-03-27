import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { withRateLimit, setOnRateLimitError } from "./rate-limit";

function make429Error(message = "Rate limited") {
  const error = new Error(message) as Error & { response: { status: number } };
  error.response = { status: 429 };
  return error;
}

function makeError(status: number, message = "Error") {
  const error = new Error(message) as Error & { response: { status: number } };
  error.response = { status };
  return error;
}

describe("withRateLimit", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    setOnRateLimitError(null);
  });

  afterEach(() => {
    setOnRateLimitError(null);
  });

  it("returns the result of a successful call", async () => {
    const result = await withRateLimit(() => Promise.resolve("ok"));
    expect(result).toBe("ok");
  });

  it("retries on 429 and eventually succeeds", async () => {
    let calls = 0;
    const fn = () => {
      calls++;
      if (calls < 2) return Promise.reject(make429Error());
      return Promise.resolve("success");
    };

    const result = await withRateLimit(fn, "test-429");
    expect(result).toBe("success");
    expect(calls).toBe(2);
    expect(console.warn).toHaveBeenCalledTimes(1);
  }, 10_000);

  it("retries on 403 (user rate limit exceeded)", async () => {
    let calls = 0;
    const fn = () => {
      calls++;
      if (calls < 2) return Promise.reject(makeError(403, "User rate limit exceeded"));
      return Promise.resolve("ok");
    };

    const result = await withRateLimit(fn, "test-403");
    expect(result).toBe("ok");
    expect(calls).toBe(2);
    expect(console.warn).toHaveBeenCalledTimes(1);
  }, 10_000);

  it("retries on 5xx errors", async () => {
    let calls = 0;
    const fn = () => {
      calls++;
      if (calls < 2) return Promise.reject(makeError(503, "Service unavailable"));
      return Promise.resolve("ok");
    };

    const result = await withRateLimit(fn, "test-503");
    expect(result).toBe("ok");
    expect(calls).toBe(2);
  }, 10_000);

  it("throws non-retryable errors immediately", async () => {
    let calls = 0;
    const fn = () => {
      calls++;
      return Promise.reject(makeError(404, "Not found"));
    };

    await expect(withRateLimit(fn)).rejects.toThrow("Not found");
    expect(calls).toBe(1);
  });

  it("throws non-API errors without retrying", async () => {
    let calls = 0;
    const fn = () => {
      calls++;
      return Promise.reject(new Error("Network failure"));
    };

    await expect(withRateLimit(fn)).rejects.toThrow("Network failure");
    expect(calls).toBe(1);
  });

  it("logs context in warning messages", async () => {
    let calls = 0;
    const fn = () => {
      calls++;
      if (calls < 2) return Promise.reject(make429Error());
      return Promise.resolve("ok");
    };

    await withRateLimit(fn, "files.list folder=abc123");
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining("[files.list folder=abc123]"),
    );
  }, 10_000);

  it("invokes onRateLimitError callback on retry", async () => {
    const callback = vi.fn();
    setOnRateLimitError(callback);

    let calls = 0;
    const fn = () => {
      calls++;
      if (calls < 2) return Promise.reject(make429Error());
      return Promise.resolve("ok");
    };

    await withRateLimit(fn, "test-callback");
    expect(callback).toHaveBeenCalledWith("test-callback", 429, 1, false);
  }, 10_000);

  it("invokes onRateLimitError with exhausted=true when retries are spent", async () => {
    const callback = vi.fn();
    setOnRateLimitError(callback);

    const fn = () => Promise.reject(make429Error());

    await expect(withRateLimit(fn, "exhaust-test")).rejects.toThrow("Rate limited");

    const lastCall = callback.mock.calls[callback.mock.calls.length - 1];
    expect(lastCall).toEqual(["exhaust-test", 429, expect.any(Number), true]);
  }, 60_000);
});
