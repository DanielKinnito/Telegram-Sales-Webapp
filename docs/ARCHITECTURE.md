# Telegram Sales WebApp & Notion CRM Architecture

## System Overview
A production-ready Telegram Mini App (TWA) and Telegram Bot integrated with Notion as a relational CRM datastore. Serves 6 Sales Reps, 1 Front Desk Receptionist, and 3 Executive Managers.

```
+-----------------------------------------------------------------------------------+
|                              Client Interfaces                                    |
|   +------------------------------------+  +-----------------------------------+   |
|   |   Sales Rep & Front Desk TWA       |  |       Telegram Bot Engine         |   |
|   | (Vite + React + Tailwind + SDK)    |  |    (GrammY Bot Onboarding)        |   |
|   +-----------------+------------------+  +-----------------+-----------------+   |
+---------------------|---------------------------------------|---------------------+
                      | HMAC-SHA256 InitData Auth             | Webhook / Polling
                      v                                       v
+-----------------------------------------------------------------------------------+
|                              Backend Layer (Express 5)                            |
|                                                                                   |
|  [Auth Middleware] -> Validates Telegram initData & verifies Active Rep/Staff     |
|                                                                                   |
|  +--------------------+  +--------------------+  +------------------------------+ |
|  |    Leads & TIN     |  | Rotational Queue   |  |   Deals & Proof Upload       | |
|  |    Service         |  | Service            |  |   Service                    | |
|  +---------+----------+  +---------+----------+  +--------------+---------------+ |
|            |                       |                            |                 |
|            | Sub-100ms In-Memory   | Round-Robin                | Modular Storage |
|            | TIN Cache             | Oldest-Timestamp           | Adapter Layer   |
+------------|-----------------------|----------------------------|-----------------+
             |                       |                            |
             v                       v                            v
   +--------------------+  +--------------------+       +-------------------------+
   |   Notion CRM API   |  |   Notion CRM API   |       | Storage Drivers         |
   | (Accounts DB,      |  | (Queue DB,         |       | - Supabase Storage      |
   |  Sales Reps DB)    |  |  Contacts DB)      |       |   (payment-proofs bucket|
   | Resilient Wrapper  |  | Resilient Wrapper  |       | - AWS S3 / Cloudflare R2|
   | (Rate-limit backoff|  | (Rate-limit backoff|       |   (Zero-lockin stubs)   |
   +--------------------+  +--------------------+       +-------------------------+
```

---

## Modular Storage Architecture (Adapter Pattern)

To achieve zero vendor lock-in between the initial development/pitch phase and future production scale, file uploads use the Adapter Pattern.

### Storage Interface (`backend/src/services/storage/types.ts`)
```typescript
export interface StorageProvider {
  uploadFile(buffer: Buffer, filename: string, mimeType: string): Promise<string>;
  getPublicUrl(filePath: string): string;
}
```

### Active Drivers:
1. **Supabase Storage Driver (`SupabaseStorageProvider`)** [Active for Pitch/Dev Phase]:
   - Avoids upfront AWS billing complexity during development and pitching.
   - Target Bucket: `payment-proofs` (public access enabled, max 5 MB).
   - Generates unique timestamped object keys (`receipts/<timestamp>-<filename>`).
   - Retrieves public CDN URL directly to store in the Notion Deal record (`Payment Proof URL`).
2. **AWS S3 / Cloudflare R2 Driver (`S3StorageProvider`)** [Migration Stub]:
   - Provides drop-in capability to switch drivers via environment variable without modifying business logic.
3. **Mock Storage Driver (`MockStorageProvider`)**:
   - In-memory mock for automated unit testing and offline development.

### Storage Configuration & Environment Variables:
- `STORAGE_PROVIDER`: `"supabase" | "s3" | "r2" | "mock"` (Default: `"supabase"`)
- `SUPABASE_URL`: Supabase project endpoint
- `SUPABASE_ANON_KEY`: Supabase API key (supports `sb_publishable_...` format)
- `SUPABASE_BUCKET_NAME`: Name of bucket (Default: `"payment-proofs"`)

---

## Notion Relational CRM Datastores

All CRM entities reside in dedicated Notion databases queried through Notion API (SDK v5 Data Sources):
1. **Sales Reps DB (`NOTION_SALES_REPS_DB_ID`)**: Staff accounts, Telegram user IDs, roles (`Sales Rep`, `Front Desk`, `Manager`), and approval statuses (`Active`, `Pending Approval`).
2. **Accounts DB (`NOTION_ACCOUNTS_DB_ID`)**: Customer entities with unique 10-digit TINs, company names, assigned dates, and `Owner` relation to Sales Reps.
3. **Rotational Queue DB (`NOTION_QUEUE_DB_ID`)**: Front-desk round-robin state tracking rep availability (`Available`, `Busy`, `Offline`) and `Last Assigned Timestamp`.
4. **Deals DB (`NOTION_DEALS_DB_ID`)**: Commercial opportunities tracking stages (`New`, `Contacted`, `Proposal`, `Payment Pending Verification`, `Won`, `Lost`), amounts, `Deposit Ref #`, and `Payment Proof URL`.
5. **Contacts DB (`NOTION_CONTACTS_DB_ID`)**: Customer stakeholder contacts linked to Accounts.
6. **Sales Logs DB (`NOTION_SALES_LOGS_DB_ID`)**: Interaction history (calls, meetings, notes).

---

## Security & Reliability Guardrails
1. **HMAC-SHA256 Authentication**: Every backend route requires Telegram WebApp `initData` in `Authorization: tma <rawInitData>` verified using `TELEGRAM_BOT_TOKEN`.
2. **Notion Rate Limit Protection**: All Notion SDK queries route through `ResilientNotionClient` with exponential backoff respecting Notion's 3 requests/sec rate limit.
3. **Sub-100ms Duplicate TIN Prevention**: In-memory `TinCache` caches registered 10-digit TINs to block concurrent double-registrations instantly.
