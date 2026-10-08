# Project Constitution: Telegram Mini App & Notion CRM

## Project Overview
A production-ready Telegram Mini App (TWA) and Telegram Bot integrated with Notion as a relational CRM datastore. Serves 6 Sales Reps, 1 Front Desk Receptionist, and 3 Executive Managers.

## Core Tech Stack
- Runtime: Node.js (TypeScript)
- Framework: Fastify / Express
- Bot Engine: GrammY (`grammy`)
- Frontend: Vite + React (TypeScript) + Tailwind CSS + `@telegram-apps/sdk-react`
- Datastore: Notion API (`@notionhq/client`)
- Storage: Cloudflare R2 / AWS S3 (pre-signed upload URLs)
- Architecture Pattern: Modular service layer with caching and retry wrappers.

## Non-Negotiable Operational Rules
1. Scope Discipline: Touch only files directly related to the user's explicit task. Do not refactor adjacent modules unless requested.
2. Surface Assumptions & Ask: If an ambiguous edge case arises (e.g., conflicting TIN formats or Notion schema mismatches), ask before proceeding.
3. Verification Gate: Every API endpoint and business rule must produce verification evidence (passing unit/integration test or execution log) before calling the task complete.
4. Security & Cryptography:
   - NEVER trust `telegram_id` passed via plain request bodies.
   - ALWAYS validate Telegram `initData` using HMAC-SHA256 with the bot token on every protected route.
   - NEVER expose Notion internal integration tokens or Bot API keys to the frontend.
5. Notion Resilience:
   - Wrap all Notion SDK calls with exponential backoff / retry logic to respect Notion's 3 req/sec rate limit.
   - Cache registered TINs in memory to ensure sub-100ms conflict lookups.

## Skills & Workflows
When instructed or working on relevant phases, reference the runbooks in `.agent/skills/`:
- `spec-driven-development`: Write API contracts & acceptance criteria before implementation.
- `test-driven-development`: Red-Green-Refactor cycle for critical logic (TIN checks, round-robin pointer, initData parsing).
- `code-review-and-quality`: Pre-commit inspection checklist for security leaks, unhandled promises, and edge cases.