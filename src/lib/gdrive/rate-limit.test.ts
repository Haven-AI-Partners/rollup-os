import { describe, it, expect, vi, beforeEach } from "vitest";
import { withRateLimit } from "./rate-limit";

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
    vi.spyOn(console, "warn").mockImplementation(() => {});
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
});
