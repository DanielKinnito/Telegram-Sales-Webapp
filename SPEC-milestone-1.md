# Spec: Milestone 1 - Core Engine & Security

## Objective
Establish the foundational backend architecture for the Telegram Sales Mini App & Notion CRM integration.
This milestone delivers:
1. Robust environment configuration validation with Zod.
2. Cryptographic Telegram `initData` HMAC-SHA256 signature verification middleware to ensure zero unauthorized requests and protect sales rep identity.
3. Resilient Notion API client wrapper implementing proactive rate-limiting (3 req/sec) and exponential backoff retry logic.
4. Comprehensive test coverage using Vitest adhering to Test-Driven Development (TDD).

## Tech Stack
- Runtime: Node.js (v20+ / TypeScript 5+)
- Web Framework: Express 5 (`express`)
- Validation: Zod (`zod`)
- Bot/Auth Integration: `@telegram-apps/init-data-node`, `crypto`
- Datastore SDK: `@notionhq/client`
- Test Runner: Vitest (`vitest`)
- Tooling: `tsx`

## Commands
- Build / Typecheck: `npm run typecheck` (`tsc --noEmit`)
- Run Tests: `npm test` (`vitest run`)
- Dev Server: `npm run dev` (`tsx watch src/server.ts`)

## Project Structure
```
backend/
├── src/
│   ├── app.ts                  # Express app initialization & route registration
│   ├── server.ts               # HTTP server listener entry point
│   ├── config/
│   │   ├── env.ts              # Zod environment schema & validated config
│   │   └── env.test.ts         # Environment validation unit tests
│   └── modules/
│       ├── auth/
│       │   ├── telegramAuth.ts # HMAC-SHA256 initData middleware & validators
│       │   └── telegramAuth.test.ts # Auth middleware unit & security tests
│       └── notion/
│           ├── notionClient.ts # Resilient Notion client wrapper with retry & rate limiting
│           └── notionClient.test.ts # Notion wrapper retry & rate limiting tests
├── package.json
└── tsconfig.json
```

## Code Style & Conventions
- Pure TypeScript with strict mode (`strict: true`, `exactOptionalPropertyTypes: true`).
- Clean separation between pure logic, middleware, and I/O.
- Factory functions to enable clean dependency injection in tests (e.g., `createTelegramAuthMiddleware(botToken)`).
- Error responses follow uniform JSON: `{ error: string, details?: string | unknown }`.

Example:
```typescript
import type { Request, Response, NextFunction } from "express";

export interface AuthenticatedRequest extends Request {
  telegramUser?: {
    id: number;
    firstName: string;
    lastName?: string | undefined;
    username?: string | undefined;
  };
}
```

## Testing Strategy
- Framework: Vitest (`vitest run`).
- Hierarchy:
  - Unit tests for pure validation and HMAC calculation (Small, fast).
  - Middleware behavior tests verifying 401 on tampered signatures, expired tokens, missing headers, and 200 on valid signatures.
  - Resilience tests for Notion client verifying exponential retry on 429 rate limits, 502/503/504 errors, and immediate failure on 400/401/404 client errors.
- Mocking: Mock external Notion HTTP calls and timer sleeps using Vitest fake timers and spies; no network calls during unit tests.

## Boundaries
- **Always do:**
  - Validate Telegram `initData` using HMAC-SHA256 with the bot token on every protected route.
  - Never trust unverified client-provided Telegram IDs.
  - Respect Notion's rate limits and exponential backoff retry guidelines.
  - Verify all test suites pass with zero failures.
- **Ask first:**
  - Modifying Notion database schema properties.
  - Adding heavy external state stores (e.g., external Redis) before Milestone 3.
- **Never do:**
  - Expose `NOTION_API_KEY` or `TELEGRAM_BOT_TOKEN` in responses or logs.
  - Bypass HMAC verification in production mode.
  - Allow unhandled promise rejections.

## Success Criteria
1. `validateEnv()` correctly parses valid envs and produces actionable error details when required fields (`TELEGRAM_BOT_TOKEN`, `NOTION_API_KEY`, Notion DB IDs) are missing.
2. `verifyTelegramAuth` middleware strictly validates `initData`, rejects expired (`auth_date`) and forged HMAC hashes with 401, and extracts authenticated `telegramUser`.
3. `ResilientNotionClient` / `withRetry` executes Notion operations, proactively throttles to adhere to 3 req/sec, retries transient 429/5xx errors up to configured attempts, and throws immediately on permanent 4xx errors.
4. All unit and integration tests pass with 100% green status under `npm test`.
5. TypeScript compilation passes (`npm run typecheck`).

## Open Questions & Assumptions
- **Assumption 1**: Bot token used for signature verification comes from `.env` (`TELEGRAM_BOT_TOKEN`).
- **Assumption 2**: InitData auth header format is `Authorization: tma <rawInitData>` with fallback support for `x-telegram-init-data` header.
- **Assumption 3**: Max token validity period defaults to 86,400 seconds (24 hours).
