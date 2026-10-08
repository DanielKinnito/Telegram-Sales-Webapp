# Spec: Milestone 3 - TIN Verification & Lead Registration (Workflow B)

## Objective
Implement Workflow B from `PRD.md` to prevent duplicate client registrations and protect sales rep ownership:
1. Provide an in-memory cache of registered TINs that ensures sub-100ms duplicate lookup times without saturating Notion's 3 req/sec rate limit.
2. Enforce strict 10-digit numeric TIN validation (`^\d{10}$`).
3. Expose protected endpoint `POST /api/leads/check-tin` to check availability and return detailed conflict metadata if owned by another sales rep.
4. Expose protected endpoint `POST /api/leads/register` to create Accounts in Notion and link the account to the requesting Sales Rep record.
5. Provide comprehensive test coverage with Vitest using TDD.

## Tech Stack
- Runtime: Node.js (TypeScript ESM)
- Framework: Express 5 (`express`)
- Auth: Telegram `initData` HMAC verification (`verifyTelegramAuth`)
- Datastore: Notion API via `ResilientNotionClient`
- Validation: Zod (`tinValidator.ts`, `zod`)
- Test Runner: Vitest (`vitest run`)

## Project Structure
```
backend/
├── src/
│   ├── modules/
│   │   ├── leads/
│   │   │   ├── tinCache.ts           # In-memory TIN cache with TTL and sync
│   │   │   ├── tinCache.test.ts      # Cache latency and synchronization tests
│   │   │   ├── leadsService.ts       # Notion Account creation & ownership linking
│   │   │   ├── leadsService.test.ts  # Service unit tests
│   │   │   ├── leadsController.ts    # Express request handlers & validation
│   │   │   ├── leadsRoutes.ts        # Route registration
│   │   │   └── leads.test.ts         # End-to-end HTTP integration tests
```

## API Contracts

### 1. `POST /api/leads/check-tin`
**Headers:**
`Authorization: tma <rawInitData>`

**Request Body:**
```json
{
  "tin": "0012345678"
}
```

**Success Response (Available - 200 OK):**
```json
{
  "available": true,
  "message": "TIN is available for registration."
}
```

**Conflict Response (Duplicate - 409 Conflict):**
```json
{
  "available": false,
  "message": "Company registered under John Doe on 2026-10-01. Duplicate registration blocked. Please contact John Doe for internal transfers.",
  "conflict": {
    "companyName": "Acme Corp",
    "ownerName": "John Doe",
    "assignedDate": "2026-10-01"
  }
}
```

**Validation Error (400 Bad Request):**
```json
{
  "error": "Validation Error",
  "details": "TIN Number must be exactly 10 numeric digits (e.g. 0012345678)"
}
```

---

### 2. `POST /api/leads/register`
**Headers:**
`Authorization: tma <rawInitData>`

**Request Body:**
```json
{
  "companyName": "Acme Corp",
  "tin": "0012345678",
  "address": "Bole Sub-City, Addis Ababa",
  "industry": "Technology"
}
```

**Security Rule:**
`telegram_id` MUST be extracted from `req.telegramUser.id` (set by HMAC auth middleware). Never accept client-supplied ownership IDs.

**Success Response (201 Created):**
```json
{
  "success": true,
  "account": {
    "pageId": "...",
    "companyName": "Acme Corp",
    "tin": "0012345678",
    "industry": "Technology",
    "owner": {
      "telegramId": "61917289",
      "fullName": "Tester One"
    },
    "assignedDate": "2026-10-08"
  }
}
```

**Conflict / Validation Errors:**
- `400 Bad Request` if TIN is not 10 digits or company name is missing.
- `403 Forbidden` if the authenticated user is not an Active Sales Rep or Front Desk.
- `409 Conflict` if TIN was registered concurrently.

## Cache Design
- `TinCache` stores a Map of `tin -> { companyName, ownerName, assignedDate, pageId }`.
- `warmup(notionClient, accountsDbId)`: On startup or lazy initialization, queries Accounts DB and populates memory.
- Lookup time: `< 5ms`.
- Cache invalidation / update: Automatically updated when `register` succeeds.

## Testing Strategy
1. **Cache Tests**:
   - Cache warmup and lookup latency.
   - Cache set, get, has, invalidate.
2. **Service Tests**:
   - Rejects non-10 digit TINs.
   - Detects existing TIN conflict.
   - Creates Notion Account page with relation to Sales Rep.
3. **HTTP Integration Tests**:
   - Full flow with mock and real HTTP requests:
     - Unauthenticated requests rejected with 401.
     - Invalid TIN format rejected with 400.
     - New TIN returns 200 `{ available: true }`.
     - Register creates record and subsequent check-tin returns 409 Conflict.

## Boundaries
- **Always do:**
  - Verify HMAC `initData` on all lead endpoints.
  - Reject non-10 digit TINs before any database or cache queries.
  - Ensure the requesting sales rep is `Active` before creating accounts.
- **Never do:**
  - Allow duplicate TIN registrations.
  - Query Notion directly on every TIN keystroke; use the in-memory cache for fast lookups.
