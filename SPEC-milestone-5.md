# Spec: Milestone 5 - Deal Updates & Payment Proofs (Workflow D)

## Objective
Implement Workflow D from `PRD.md` to support purchase and payment proof logging for sales reps:
1. Provide a storage service interface for receipt/proof image uploads (supporting Cloudflare R2 / AWS S3 presigned URLs with development/local storage fallback).
2. Implement deal progression logic that updates the deal's Stage in Notion `Deals DB` to `"Payment Pending Verification"`.
3. Store the `Deposit Ref #` and `Payment Proof URL` on the Notion deal record.
4. Dispatch Telegram push notifications to all configured Managers (`TELEGRAM_MANAGER_CHAT_IDS`) alerting them of incoming payment verification with deal title, amount, deposit ref, and proof link.
5. Provide comprehensive unit and HTTP integration tests with Vitest using TDD.

## Tech Stack
- Runtime: Node.js (TypeScript ESM)
- Framework: Express 5 (`express`)
- Telegram Engine: GrammY (`grammy`)
- Datastore: Notion API via `ResilientNotionClient`
- Storage: Supabase Storage (`@supabase/supabase-js`, `payment-proofs` bucket) with Adapter Pattern (`StorageProvider` interface for zero-vendor-lockin S3/R2 migration)
- Validation: Zod (`zod`)
- Test Runner: Vitest (`vitest run`)

## Commands
- Build / Typecheck: `npm run typecheck`
- Test: `npm test`
- Dev Backend: `npm run dev:backend`

## Project Structure
```
backend/
├── src/
│   ├── services/
│   │   ├── storage/
│   │   │   ├── types.ts            # Generic StorageProvider interface
│   │   │   ├── supabaseStorage.ts  # Supabase Storage driver implementation
│   │   │   ├── s3Storage.ts        # AWS S3 / Cloudflare R2 migration adapter stub
│   │   │   ├── mockStorage.ts      # Offline/test in-memory mock driver
│   │   │   ├── index.ts            # Storage factory & singleton export
│   │   │   └── storage.test.ts     # Storage driver unit tests
│   ├── modules/
│   │   ├── deals/
│   │   │   ├── dealsService.ts     # Deal retrieval, progression, and Notion sync
│   │   │   ├── dealsService.test.ts # Deal service unit tests
│   │   │   ├── dealsRoutes.ts      # POST /api/deals/:id/payment-proof route handler
│   │   │   └── deals.test.ts       # HTTP integration tests
```

## API Contracts

### 1. `POST /api/storage/presigned-url`
Request presigned upload URL for payment receipt photo.

**Headers:**
`Authorization: tma <rawInitData>`

**Request Body:**
```json
{
  "filename": "receipt-1029.jpg",
  "contentType": "image/jpeg"
}
```

**Success Response (200 OK):**
```json
{
  "uploadUrl": "https://...",
  "publicUrl": "https://.../receipt-1029.jpg",
  "expiresInSeconds": 900
}
```

---

### 2. `POST /api/deals/:id/payment-proof`
Submit deposit reference number and proof image URL to progress deal stage.

**Headers:**
`Authorization: tma <rawInitData>`

**Request Body:**
```json
{
  "depositRef": "CBE-TX-99881122",
  "proofUrl": "https://storage.example.com/receipt-1029.jpg"
}
```

**Security & Authorization:**
- Validates Telegram HMAC `initData`.
- Validates calling user is an Active sales rep or manager.
- Ensures `depositRef` is non-empty string and `proofUrl` is a valid URL.

**Success Response (200 OK):**
```json
{
  "success": true,
  "deal": {
    "pageId": "deal_page_123",
    "title": "Ethio Corp Bulk Order",
    "stage": "Payment Pending Verification",
    "amount": 250000,
    "depositRef": "CBE-TX-99881122",
    "proofUrl": "https://storage.example.com/receipt-1029.jpg"
  },
  "managersNotified": 3
}
```

**Error Responses:**
- `400 Bad Request` if `depositRef` is missing or `proofUrl` is not a valid URL.
- `401 Unauthorized` if Telegram `initData` is missing or invalid.
- `403 Forbidden` if user is not active staff.
- `404 Not Found` if deal page does not exist in Notion.

---

## Workflow & Logic

1. **Storage Presigning**:
   - Generates unique object key with timestamp and UUID to prevent collisions.
   - Signs S3/R2 PUT URL with configurable TTL (default 15 minutes).
   - If S3 credentials not provided in `.env` (development mode), provides mock upload URL or local development endpoint.

2. **Deal Progression**:
   - Retrieves deal page from Notion `NOTION_DEALS_DB_ID`.
   - Updates page properties:
     - `Stage`: `{ select: { name: "Payment Pending Verification" } }`
     - `Deposit Ref #`: `{ rich_text: [{ text: { content: depositRef } }] }`
     - `Payment Proof URL`: `{ url: proofUrl }`

3. **Manager Notifications**:
   - Iterates through `managerChatIds` (parsed from `TELEGRAM_MANAGER_CHAT_IDS`).
   - Sends Telegram notification:
     > 💳 *Payment Proof Submitted for Verification!*
     >
     > • *Deal:* Ethio Corp Bulk Order
     > • *Amount:* ETB 250,000
     > • *Deposit Ref #:* CBE-TX-99881122
     > • *Submitted by:* Samuel Green
     > • [View Payment Proof Image](https://storage.example.com/receipt-1029.jpg)
     >
     > Open Notion to verify deposit and move to Won.

---

## Testing Strategy
- **Unit Tests**:
  - `storageService.test.ts`: Presigned URL generation, key uniqueness, content type validation.
  - `dealsService.test.ts`: Deal retrieval, stage update to "Payment Pending Verification", Notion property mapping, manager Telegram notifications.
- **HTTP Integration Tests (`deals.test.ts`)**:
  - 401 unauthenticated requests.
  - 400 validation error on missing `depositRef` or invalid `proofUrl`.
  - 404 when deal ID is invalid or not found.
  - 200 successful progression with manager alerts.

## Boundaries
- **Always do:**
  - Verify HMAC signature on all protected endpoints.
  - Validate `proofUrl` as a valid HTTP/HTTPS URL.
  - Send notifications to all active manager IDs without blocking deal update if one notification fails.
- **Ask first:**
  - Changing Deal Stage naming in Notion.
  - Altering S3/R2 bucket configuration.
- **Never do:**
  - Trust raw body `telegram_id` without checking `req.telegramUser`.
  - Allow progressing a deal without a deposit reference number.

## Success Criteria
1. `POST /api/storage/presigned-url` returns valid upload credentials.
2. `POST /api/deals/:id/payment-proof` updates Notion deal stage to "Payment Pending Verification" and sets deposit ref & proof URL.
3. Manager chat IDs receive rich Telegram push notifications with deal details and proof link.
4. All Vitest tests pass with 100% green status and TypeScript passes with zero errors.
