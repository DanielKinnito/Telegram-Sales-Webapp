import * as dotenv from "dotenv";
import * as path from "path";
import { fileURLToPath } from "url";
import { z } from "zod";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

export const envSchema = z.object({
  PORT: z.string().default("3000"),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  TELEGRAM_BOT_TOKEN: z.string().min(1, "TELEGRAM_BOT_TOKEN is required"),
  NOTION_API_KEY: z.string().min(1, "NOTION_API_KEY is required"),
  NOTION_SALES_REPS_DB_ID: z.string().min(1, "NOTION_SALES_REPS_DB_ID is required"),
  NOTION_ACCOUNTS_DB_ID: z.string().min(1, "NOTION_ACCOUNTS_DB_ID is required"),
  NOTION_DEALS_DB_ID: z.string().min(1, "NOTION_DEALS_DB_ID is required"),
  NOTION_CONTACTS_DB_ID: z.string().min(1, "NOTION_CONTACTS_DB_ID is required"),
  NOTION_SALES_LOGS_DB_ID: z.string().min(1, "NOTION_SALES_LOGS_DB_ID is required"),
  NOTION_QUEUE_DB_ID: z.string().min(1, "NOTION_QUEUE_DB_ID is required"),
  NOTION_REPORTS_DB_ID: z.string().optional(),
  NOTION_INVENTORY_DB_ID: z.string().optional().default("796f44a2-1044-4a4c-8adc-74a97fbbec94"),
  NOTION_PARENT_PAGE_ID: z.string().optional(),
  TELEGRAM_MANAGER_CHAT_IDS: z.string().optional().default(""),
  STORAGE_PROVIDER: z.enum(["supabase", "s3", "r2", "mock"]).default("supabase"),
  SUPABASE_URL: z.string().optional(),
  SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_BUCKET_NAME: z.string().default("payment-proofs"),
  VERIFY_ET_API_KEY: z.string().optional(),
  WEBAPP_URL: z.string().optional(),
  USE_WEBHOOK: z.enum(["true", "false", "auto"]).default("auto"),
  TELEGRAM_WEBHOOK_SECRET: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(rawEnv: Record<string, unknown>): Env {
  const effectiveRaw = {
    ...rawEnv,
    WEBAPP_URL: rawEnv.WEBAPP_URL || rawEnv.RENDER_EXTERNAL_URL,
  };
  const parsed = envSchema.safeParse(effectiveRaw);
  if (!parsed.success) {
    const errorMessages = parsed.error.issues
      .map((issue) => `[${issue.path.join(".") || "root"}]: ${issue.message}`)
      .join("; ");
    throw new Error(`Environment validation failed: ${errorMessages}`);
  }
  return parsed.data;
}

export const env = validateEnv(process.env);