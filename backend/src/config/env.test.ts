import { describe, it, expect } from "vitest";
import { validateEnv, envSchema } from "./env.js";

describe("Environment Validation", () => {
  const validEnv = {
    PORT: "4000",
    NODE_ENV: "test",
    TELEGRAM_BOT_TOKEN: "123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ",
    NOTION_API_KEY: "secret_notion_key_test_12345",
    NOTION_SALES_REPS_DB_ID: "db_sales_reps_id",
    NOTION_ACCOUNTS_DB_ID: "db_accounts_id",
    NOTION_DEALS_DB_ID: "db_deals_id",
    NOTION_CONTACTS_DB_ID: "db_contacts_id",
    NOTION_SALES_LOGS_DB_ID: "db_sales_logs_id",
    NOTION_QUEUE_DB_ID: "db_queue_id",
    NOTION_PARENT_PAGE_ID: "page_parent_id",
  };

  it("validates and parses a complete valid environment configuration", () => {
    const result = validateEnv(validEnv);
    expect(result.PORT).toBe("4000");
    expect(result.NODE_ENV).toBe("test");
    expect(result.TELEGRAM_BOT_TOKEN).toBe(validEnv.TELEGRAM_BOT_TOKEN);
    expect(result.NOTION_API_KEY).toBe(validEnv.NOTION_API_KEY);
    expect(result.NOTION_SALES_REPS_DB_ID).toBe(validEnv.NOTION_SALES_REPS_DB_ID);
    expect(result.NOTION_ACCOUNTS_DB_ID).toBe(validEnv.NOTION_ACCOUNTS_DB_ID);
    expect(result.NOTION_DEALS_DB_ID).toBe(validEnv.NOTION_DEALS_DB_ID);
    expect(result.NOTION_CONTACTS_DB_ID).toBe(validEnv.NOTION_CONTACTS_DB_ID);
    expect(result.NOTION_SALES_LOGS_DB_ID).toBe(validEnv.NOTION_SALES_LOGS_DB_ID);
    expect(result.NOTION_QUEUE_DB_ID).toBe(validEnv.NOTION_QUEUE_DB_ID);
    expect(result.NOTION_PARENT_PAGE_ID).toBe("page_parent_id");
  });

  it("applies default values for PORT and NODE_ENV when omitted", () => {
    const { PORT, NODE_ENV, ...minimalEnv } = validEnv;
    const result = validateEnv(minimalEnv);
    expect(result.PORT).toBe("3000");
    expect(result.NODE_ENV).toBe("development");
  });

  it("throws descriptive error when required TELEGRAM_BOT_TOKEN is missing", () => {
    const { TELEGRAM_BOT_TOKEN, ...missingTokenEnv } = validEnv;
    expect(() => validateEnv(missingTokenEnv)).toThrowError(/TELEGRAM_BOT_TOKEN/);
  });

  it("throws descriptive error when required NOTION_API_KEY is missing", () => {
    const { NOTION_API_KEY, ...missingApiKeyEnv } = validEnv;
    expect(() => validateEnv(missingApiKeyEnv)).toThrowError(/NOTION_API_KEY/);
  });

  it("throws descriptive error when any Notion DB ID is missing", () => {
    const { NOTION_SALES_REPS_DB_ID, ...missingDbEnv } = validEnv;
    expect(() => validateEnv(missingDbEnv)).toThrowError(/NOTION_SALES_REPS_DB_ID/);
  });

  it("allows optional NOTION_PARENT_PAGE_ID to be omitted", () => {
    const { NOTION_PARENT_PAGE_ID, ...noParentEnv } = validEnv;
    const result = validateEnv(noParentEnv);
    expect(result.NOTION_PARENT_PAGE_ID).toBeUndefined();
  });

  it("applies default values for storage provider and bucket name", () => {
    const result = validateEnv(validEnv);
    expect(result.STORAGE_PROVIDER).toBe("supabase");
    expect(result.SUPABASE_BUCKET_NAME).toBe("payment-proofs");
  });

  it("parses custom storage provider and supabase credentials", () => {
    const customStorageEnv = {
      ...validEnv,
      STORAGE_PROVIDER: "s3" as const,
      SUPABASE_URL: "https://my-project.supabase.co",
      SUPABASE_ANON_KEY: "sb_publishable_custom_key_123",
      SUPABASE_BUCKET_NAME: "custom-receipts",
    };
    const result = validateEnv(customStorageEnv);
    expect(result.STORAGE_PROVIDER).toBe("s3");
    expect(result.SUPABASE_URL).toBe("https://my-project.supabase.co");
    expect(result.SUPABASE_ANON_KEY).toBe("sb_publishable_custom_key_123");
    expect(result.SUPABASE_BUCKET_NAME).toBe("custom-receipts");
  });
});
