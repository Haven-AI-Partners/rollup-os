import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { withRateLimit, setOnRateLimitError, isAuthError } from "./rate-limit";
import { GDriveAuthError } from "./errors";

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
    vi.useFakeTimers();
    vi.restoreAllMocks();
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    setOnRateLimitError(null);
  });

  afterEach(() => {
    setOnRateLimitError(null);
    vi.useRealTimers();
  });

  it("returns the result of a successful call", async () => {
    const promise = withRateLimit(() => Promise.resolve("ok"));
    await vi.runAllTimersAsync();
    const result = await promise;
    expect(result).toBe("ok");
  });

  it("retries on 429 and eventually succeeds", async () => {
    let calls = 0;
    const fn = () => {
      calls++;
      if (calls < 2) return Promise.reject(make429Error());
      return Promise.resolve("success");
    };

    const promise = withRateLimit(fn, "test-429");
    await vi.runAllTimersAsync();
    const result = await promise;
    expect(result).toBe("success");
    expect(calls).toBe(2);
    expect(console.warn).toHaveBeenCalledTimes(1);
  });

  it("retries on 403 (user rate limit exceeded)", async () => {
    let calls = 0;
    const fn = () => {
      calls++;
      if (calls < 2) return Promise.reject(makeError(403, "User rate limit exceeded"));
      return Promise.resolve("ok");
    };

    const promise = withRateLimit(fn, "test-403");
    await vi.runAllTimersAsync();
    const result = await promise;
    expect(result).toBe("ok");
    expect(calls).toBe(2);
    expect(console.warn).toHaveBeenCalledTimes(1);
  });

  it("retries on 5xx errors", async () => {
    let calls = 0;
    const fn = () => {
      calls++;
      if (calls < 2) return Promise.reject(makeError(503, "Service unavailable"));
      return Promise.resolve("ok");
    };

    const promise = withRateLimit(fn, "test-503");
    await vi.runAllTimersAsync();
    const result = await promise;
    expect(result).toBe("ok");
    expect(calls).toBe(2);
  });

  it("throws non-retryable errors immediately", async () => {
    let calls = 0;
    const fn = () => {
      calls++;
      return Promise.reject(makeError(404, "Not found"));
    };

    const promise = withRateLimit(fn).catch((e) => e);
    await vi.runAllTimersAsync();
    const error = await promise;
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe("Not found");
    expect(calls).toBe(1);
  });

  it("throws non-API errors without retrying", async () => {
    let calls = 0;
    const fn = () => {
      calls++;
      return Promise.reject(new Error("Network failure"));
    };

    const promise = withRateLimit(fn).catch((e) => e);
    await vi.runAllTimersAsync();
    const error = await promise;
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe("Network failure");
    expect(calls).toBe(1);
  });

  it("logs context in warning messages", async () => {
    let calls = 0;
    const fn = () => {
      calls++;
      if (calls < 2) return Promise.reject(make429Error());
      return Promise.resolve("ok");
    };

    const promise = withRateLimit(fn, "files.list folder=abc123");
    await vi.runAllTimersAsync();
    await promise;
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining("[files.list folder=abc123]"),
    );
  });

  it("invokes onRateLimitError callback on retry", async () => {
    const callback = vi.fn();
    setOnRateLimitError(callback);

    let calls = 0;
    const fn = () => {
      calls++;
      if (calls < 2) return Promise.reject(make429Error());
      return Promise.resolve("ok");
    };

    const promise = withRateLimit(fn, "test-callback");
    await vi.runAllTimersAsync();
    await promise;
    expect(callback).toHaveBeenCalledWith("test-callback", 429, 1, false);
  });

  it("invokes onRateLimitError with exhausted=true when retries are spent", async () => {
    const callback = vi.fn();
    setOnRateLimitError(callback);

    const fn = () => Promise.reject(make429Error());

    const promise = withRateLimit(fn, "exhaust-test").catch((e) => e);
    await vi.runAllTimersAsync();
    const error = await promise;
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe("Rate limited");

    const lastCall = callback.mock.calls[callback.mock.calls.length - 1];
    expect(lastCall).toEqual(["exhaust-test", 429, expect.any(Number), true]);
  });

  it("throws GDriveAuthError on auth errors without retrying", async () => {
    let calls = 0;
    const fn = () => {
      calls++;
      return Promise.reject(new Error("invalid_request"));
    };

    const promise = withRateLimit(fn, "auth-test").catch((e) => e);
    await vi.runAllTimersAsync();
    const error = await promise;
    expect(error).toBeInstanceOf(GDriveAuthError);
    expect((error as GDriveAuthError).message).toContain("invalid_request");
    expect((error as GDriveAuthError).originalError).toBeInstanceOf(Error);
    expect(calls).toBe(1);
  });

  it("throws GDriveAuthError on HTTP 401 without retrying", async () => {
    let calls = 0;
    const fn = () => {
      calls++;
      return Promise.reject(makeError(401, "Unauthorized"));
    };

    const promise = withRateLimit(fn, "401-test").catch((e) => e);
    await vi.runAllTimersAsync();
    const error = await promise;
    expect(error).toBeInstanceOf(GDriveAuthError);
    expect(calls).toBe(1);
  });
});

describe("isAuthError", () => {
  it("detects invalid_request error message", () => {
    expect(isAuthError(new Error("invalid_request"))).toBe(true);
  });

  it("detects invalid_grant error message", () => {
    expect(isAuthError(new Error("invalid_grant"))).toBe(true);
  });

  it("detects invalid_client error message", () => {
    expect(isAuthError(new Error("invalid_client"))).toBe(true);
  });

  it("detects HTTP 401 response status", () => {
    const error = makeError(401, "Unauthorized");
    expect(isAuthError(error)).toBe(true);
  });

  it("detects error.code 401 (string)", () => {
    const error = Object.assign(new Error("Auth failed"), { code: "401" });
    expect(isAuthError(error)).toBe(true);
  });

  it("detects error.code 401 (number)", () => {
    const error = Object.assign(new Error("Auth failed"), { code: 401 });
    expect(isAuthError(error)).toBe(true);
  });

  it("returns false for non-auth errors", () => {
    expect(isAuthError(new Error("File not found"))).toBe(false);
    expect(isAuthError(makeError(404, "Not found"))).toBe(false);
    expect(isAuthError(null)).toBe(false);
    expect(isAuthError(undefined)).toBe(false);
  });
});
