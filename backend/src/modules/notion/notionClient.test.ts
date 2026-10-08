import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  withRetry,
  isRetryableNotionError,
  ResilientNotionClient,
  RateLimiter,
} from "./notionClient.js";

describe("Resilient Notion Client Wrapper", () => {
  describe("isRetryableNotionError", () => {
    it("identifies 429 rate limit errors as retryable", () => {
      const err429 = { status: 429, code: "rate_limited", message: "Rate limit reached" };
      expect(isRetryableNotionError(err429)).toBe(true);
    });

    it("identifies 502/503/504 server errors as retryable", () => {
      expect(isRetryableNotionError({ status: 502 })).toBe(true);
      expect(isRetryableNotionError({ status: 503, code: "service_unavailable" })).toBe(true);
      expect(isRetryableNotionError({ status: 504 })).toBe(true);
    });

    it("identifies network disconnect errors as retryable", () => {
      expect(isRetryableNotionError(new Error("fetch failed"))).toBe(true);
      expect(isRetryableNotionError({ code: "ECONNRESET" })).toBe(true);
      expect(isRetryableNotionError({ code: "ETIMEDOUT" })).toBe(true);
    });

    it("identifies 400/401/404 client errors as non-retryable", () => {
      expect(isRetryableNotionError({ status: 400, code: "validation_error" })).toBe(false);
      expect(isRetryableNotionError({ status: 401, code: "unauthorized" })).toBe(false);
      expect(isRetryableNotionError({ status: 404, code: "object_not_found" })).toBe(false);
    });
  });

  describe("withRetry exponential backoff", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    it("returns result immediately when operation succeeds on first try", async () => {
      const fn = vi.fn().mockResolvedValue({ id: "page_123", title: "Test Page" });

      const promise = withRetry(fn, { maxRetries: 3, initialDelayMs: 100 });
      await expect(promise).resolves.toEqual({ id: "page_123", title: "Test Page" });
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it("retries when operation fails with 429 and succeeds on second attempt", async () => {
      const error429 = { status: 429, code: "rate_limited", message: "Slow down" };
      const successResult = { results: [{ id: "rec_1" }] };

      let callCount = 0;
      const fn = vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          throw error429;
        }
        return successResult;
      });

      const promise = withRetry(fn, {
        maxRetries: 3,
        initialDelayMs: 200,
        factor: 2,
        jitter: false,
      });

      // Fast-forward fake timer past the first delay
      await vi.advanceTimersByTimeAsync(250);

      const result = await promise;
      expect(result).toEqual(successResult);
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it("aborts immediately without retrying on 400 validation error", async () => {
      const error400 = { status: 400, code: "validation_error", message: "Invalid property" };
      const fn = vi.fn().mockRejectedValue(error400);

      const promise = withRetry(fn, { maxRetries: 3, initialDelayMs: 200 });

      await expect(promise).rejects.toEqual(error400);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it("throws the error after exceeding maxRetries on continuous 503s", async () => {
      const error503 = { status: 503, code: "service_unavailable" };
      const fn = vi.fn().mockRejectedValue(error503);

      const promise = withRetry(fn, {
        maxRetries: 2,
        initialDelayMs: 100,
        factor: 2,
        jitter: false,
      });

      // Attach catch handler to prevent unhandled rejection during time progression
      let capturedError: unknown;
      promise.catch((err) => {
        capturedError = err;
      });

      // Attempt 1 -> fails -> wait 100ms
      await vi.advanceTimersByTimeAsync(150);
      // Attempt 2 -> fails -> wait 200ms
      await vi.advanceTimersByTimeAsync(250);
      // Attempt 3 -> fails -> max retries exceeded

      await expect(promise).rejects.toEqual(error503);
      expect(fn).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
    });
  });

  describe("RateLimiter", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    it("limits throughput to configured requests per second", async () => {
      // 3 requests per second means min interval between executions is ~334ms
      const limiter = new RateLimiter({ requestsPerSecond: 3 });
      const completed: number[] = [];

      const t0 = Date.now();
      const p1 = limiter.schedule(async () => {
        completed.push(Date.now() - t0);
      });
      const p2 = limiter.schedule(async () => {
        completed.push(Date.now() - t0);
      });
      const p3 = limiter.schedule(async () => {
        completed.push(Date.now() - t0);
      });

      // First one executes immediately
      await vi.advanceTimersByTimeAsync(10);
      expect(completed.length).toBe(1);

      // Second executes after ~334ms
      await vi.advanceTimersByTimeAsync(350);
      expect(completed.length).toBe(2);

      // Third executes after ~667ms
      await vi.advanceTimersByTimeAsync(350);
      expect(completed.length).toBe(3);

      await Promise.all([p1, p2, p3]);
    });
  });

  describe("ResilientNotionClient instance", () => {
    it("initializes with API key and exposes query / create wrappers", () => {
      const client = new ResilientNotionClient({
        apiKey: "secret_test_notion_key",
        requestsPerSecond: 3,
        maxRetries: 2,
      });

      expect(client).toBeDefined();
      expect(typeof client.execute).toBe("function");
      expect(typeof client.queryDatabase).toBe("function");
      expect(typeof client.createPage).toBe("function");
    });
  });
});
