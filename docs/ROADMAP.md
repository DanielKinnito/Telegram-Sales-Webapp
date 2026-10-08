# Telegram Sales WebApp & Notion CRM: Implementation Roadmap

## Milestone 1: Core Engine & Security
- [x] Initialize Express app with environment validation (Zod).
- [x] Implement Telegram `initData` HMAC-SHA256 signature verification middleware.
- [x] Create resilient Notion API client wrapper with exponential retry logic.
- [x] Write unit tests for auth middleware and error wrappers (`test-driven-development`).

## Milestone 2: Telegram Bot & Rep Onboarding (Workflow A)
- [x] Configure GrammY bot engine with `/start` command handler.
- [x] Query Sales Reps DB by Telegram User ID to check onboarding status.
- [x] Create registration state machine (collect Name, Phone, Role) and save to Notion as "Pending Approval".
- [x] Implement Manager approval notification via Telegram.

## Milestone 3: TIN Verification & Lead Registration (Workflow B)
- [x] Implement in-memory / fast-lookup cache for registered TINs.
- [x] Enforce strict 10-digit numeric TIN validation (`^\d{10}$`) across API and Notion.
- [x] Build `POST /api/leads/check-tin` endpoint to enforce 10-digit validation and duplicate prevention.
- [x] Build `POST /api/leads/register` to create Accounts and link to the requesting Sales Rep.
- [x] Add unit tests simulating TIN format errors, collision, and registration blocking.

## Milestone 4: Front Desk Walk-In Assignment (Workflow C)
- [x] Build round-robin assignment engine querying `Rotational Queue DB`.
- [x] Implement front-desk intake endpoint (`POST /api/queue/assign`).
- [x] Trigger instant Telegram push notifications to assigned reps upon walk-in creation.

## Milestone 5: Deal Updates & Payment Proofs (Workflow D)
- [x] Scaffold modular storage provider layer with Adapter Pattern (`StorageProvider` interface).
- [x] Implement Supabase Storage driver (`payment-proofs` bucket) with S3/R2 migration stubs.
- [x] Add Zod environment validation for `STORAGE_PROVIDER`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_BUCKET_NAME`.
- [x] Build deal progression endpoint (`POST /api/deals/:id/payment-proof`).
- [x] Update stage to "Payment Pending Verification" in Notion and alert Managers via Telegram.

## Milestone 6: Telegram Mini App Frontend (TWA)
- [x] Setup Vite + React + Tailwind + `@telegram-apps/sdk-react`.
- [x] Implement Role-Based routing (Sales Rep View vs. Front Desk View).
- [x] Build TIN Lookup & Lead Form UI with native Telegram haptic feedback.
- [x] Build Deal tracker with receipt camera/photo upload.

## Milestone 7: Automated Notification Cron
- [x] Configure daily 9:00 AM push notification worker for scheduled follow-ups.
- [x] Configure 7-day inactivity sweeper for stalled deals.