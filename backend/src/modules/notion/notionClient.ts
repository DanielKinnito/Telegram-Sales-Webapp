import { Client } from "@notionhq/client";
import { env } from "../../config/env.js";

export interface RetryOptions {
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  factor?: number;
  jitter?: boolean;
  onRetry?: (attempt: number, error: unknown, delayMs: number) => void;
}

/**
 * Inspect an error to determine whether it is transient and safe to retry.
 * Non-retryable: 400 validation error, 401 unauthorized, 403 forbidden, 404 not found.
 * Retryable: 429 rate limit, 500/502/503/504 server errors, network dropped/timeout.
 */
export function isRetryableNotionError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const err = error as Record<string, unknown>;
  const status = typeof err.status === "number" ? err.status : undefined;
  const code = typeof err.code === "string" ? err.code : undefined;
  const message = typeof err.message === "string" ? err.message : "";

  // Permanent client errors must NOT be retried
  if (status !== undefined) {
    if (status === 400 || status === 401 || status === 403 || status === 404) {
      return false;
    }
    if (status === 429 || (status >= 500 && status <= 504)) {
      return true;
    }
  }

  if (code) {
    if (code === "rate_limited" || code === "service_unavailable" || code === "internal_server_error") {
      return true;
    }
    if (code === "validation_error" || code === "unauthorized" || code === "object_not_found") {
      return false;
    }
    if (["ECONNRESET", "ETIMEDOUT", "ENOTFOUND", "EAI_AGAIN"].includes(code)) {
      return true;
    }
  }

  if (message.includes("fetch failed") || message.includes("socket hang up") || message.includes("timeout")) {
    return true;
  }

  return false;
}

/**
 * Execute an asynchronous operation with exponential backoff and jitter.
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const maxRetries = options.maxRetries ?? 3;
  const initialDelayMs = options.initialDelayMs ?? 500;
  const maxDelayMs = options.maxDelayMs ?? 8000;
  const factor = options.factor ?? 2;
  const useJitter = options.jitter ?? true;

  let attempt = 0;

  while (true) {
    try {
      return await operation();
    } catch (err: unknown) {
      attempt++;

      if (!isRetryableNotionError(err) || attempt > maxRetries) {
        throw err;
      }

      // Check for Retry-After header or property if present
      let delayMs = initialDelayMs * Math.pow(factor, attempt - 1);
      const errObj = err as Record<string, unknown>;
      if (typeof errObj.retryAfter === "number") {
        delayMs = errObj.retryAfter * 1000;
      }

      if (useJitter) {
        // Add random jitter of up to 25% to prevent thundering herd
        const jitter = Math.random() * (delayMs * 0.25);
        delayMs = Math.min(delayMs + jitter, maxDelayMs);
      } else {
        delayMs = Math.min(delayMs, maxDelayMs);
      }

      if (options.onRetry) {
        options.onRetry(attempt, err, delayMs);
      }

      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

/**
 * Sequential Rate Limiter to proactively guarantee requests do not exceed
 * Notion's 3 requests/sec rate limit.
 */
export class RateLimiter {
  private minIntervalMs: number;
  private lastExecutedTime = 0;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(options: { requestsPerSecond?: number } = {}) {
    const rps = options.requestsPerSecond ?? 3;
    this.minIntervalMs = Math.ceil(1000 / rps);
  }

  public async schedule<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue = this.queue
        .then(async () => {
          const now = Date.now();
          const elapsed = now - this.lastExecutedTime;
          if (elapsed < this.minIntervalMs) {
            const waitTime = this.minIntervalMs - elapsed;
            await new Promise((r) => setTimeout(r, waitTime));
          }
          this.lastExecutedTime = Date.now();
          return fn();
        })
        .then(resolve)
        .catch(reject);
    });
  }
}

export interface ResilientNotionOptions {
  apiKey?: string;
  client?: Client;
  requestsPerSecond?: number;
  maxRetries?: number;
  initialDelayMs?: number;
}

/**
 * Resilient Notion Client wrapper ensuring rate-limiting and exponential retries.
 */
export class ResilientNotionClient {
  public readonly rawClient: Client;
  private rateLimiter: RateLimiter;
  private retryOptions: RetryOptions;

  constructor(options: ResilientNotionOptions = {}) {
    const apiKey = options.apiKey || (typeof process !== "undefined" && process.env?.NOTION_API_KEY ? env.NOTION_API_KEY : "");
    this.rawClient = options.client || new Client({ auth: apiKey });
    this.rateLimiter = new RateLimiter({ requestsPerSecond: options.requestsPerSecond ?? 3 });
    this.retryOptions = {
      maxRetries: options.maxRetries ?? 3,
      initialDelayMs: options.initialDelayMs ?? 500,
    };
  }

  public async execute<T>(operation: (client: Client) => Promise<T>): Promise<T> {
    return this.rateLimiter.schedule(() => {
      return withRetry(() => operation(this.rawClient), this.retryOptions);
    });
  }

  private dataSourceIdCache: Map<string, string> = new Map();

  public async getDataSourceId(databaseId: string): Promise<string> {
    const cached = this.dataSourceIdCache.get(databaseId);
    if (cached) return cached;

    try {
      const db: any = await this.retrieveDatabase({ database_id: databaseId });
      const dsId = db.data_sources?.[0]?.id;
      if (dsId) {
        this.dataSourceIdCache.set(databaseId, dsId);
        return dsId;
      }
    } catch {
      // In case databaseId is already a dataSourceId or error occurs
    }

    return databaseId;
  }

  public async queryDataSource(params: Parameters<Client["dataSources"]["query"]>[0]) {
    return this.execute((client) => client.dataSources.query(params));
  }

  public async queryDatabase(
    databaseId: string,
    params: Omit<Parameters<Client["dataSources"]["query"]>[0], "data_source_id"> = {}
  ) {
    const dataSourceId = await this.getDataSourceId(databaseId);
    return this.execute((client) =>
      client.dataSources.query({
        data_source_id: dataSourceId,
        ...params,
      })
    );
  }

  public async createPage(params: Parameters<Client["pages"]["create"]>[0]) {
    return this.execute((client) => client.pages.create(params));
  }

  public async updatePage(params: Parameters<Client["pages"]["update"]>[0]) {
    return this.execute((client) => client.pages.update(params));
  }

  public async retrievePage(params: Parameters<Client["pages"]["retrieve"]>[0]) {
    return this.execute((client) => client.pages.retrieve(params));
  }

  public async retrieveDatabase(params: Parameters<Client["databases"]["retrieve"]>[0]) {
    return this.execute((client) => client.databases.retrieve(params));
  }

  public async updateDatabase(params: Parameters<Client["databases"]["update"]>[0]) {
    return this.execute((client) => client.databases.update(params));
  }

  public async createDatabase(params: Parameters<Client["databases"]["create"]>[0]) {
    return this.execute((client) => client.databases.create(params));
  }

  public async request<T extends object = Record<string, unknown>>(
    args: Parameters<Client["request"]>[0]
  ): Promise<T> {
    return this.execute((client) => client.request<T>(args));
  }
}

let defaultClientInstance: ResilientNotionClient | null = null;

export function getNotionClient(): ResilientNotionClient {
  if (!defaultClientInstance) {
    defaultClientInstance = new ResilientNotionClient({
      apiKey: env.NOTION_API_KEY,
      requestsPerSecond: 3,
      maxRetries: 3,
    });
  }
  return defaultClientInstance;
}
