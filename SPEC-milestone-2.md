# Spec: Milestone 2 - Telegram Bot Engine & Rep Onboarding (Workflow A)

## Objective
Implement the Telegram Bot engine using GrammY to manage user onboarding for the sales team (Sales Reps, Front Desk, and Managers).
When a user launches the bot via `/start`:
1. Check the Notion `Sales Reps DB` for an existing record matching their Telegram User ID.
2. **If Active**: Greet the user with their name and provide the WebApp launch button to open the Telegram Mini App.
3. **If Pending Approval**: Inform the user their onboarding request is awaiting executive approval.
4. **If Inactive**: Inform the user their access has been deactivated and to contact management.
5. **If Unregistered**: Guide the user through a conversational onboarding state machine:
   - Ask for Full Name.
   - Ask for Phone Number (support both Telegram native contact sharing button and manual text input).
   - Select Role (`Sales Rep` or `Front Desk`).
   - Create a record in Notion `Sales Reps DB` with `Status = "Pending Approval"`.
   - Dispatch an approval notification with inline action buttons (`Approve` / `Reject`) to configured Executive Managers.
   - When a manager approves/rejects, update Notion status to `Active`/`Inactive` and notify the applicant.

## Tech Stack
- Bot Engine: GrammY (`grammy`)
- Runtime: Node.js (TypeScript ESM)
- Datastore: Notion API via `ResilientNotionClient`
- Configuration: `env.ts` with optional `TELEGRAM_MANAGER_CHAT_IDS`
- Test Runner: Vitest (`vitest run`)

## Commands
- Run Tests: `npm test`
- Typecheck: `npm run typecheck`
- Start Bot / Backend: `npm run dev`

## Project Structure
```
backend/
├── src/
│   ├── modules/
│   │   ├── bot/
│   │   │   ├── bot.ts              # GrammY bot initialization & command routing
│   │   │   ├── onboarding.ts       # Onboarding state machine & Notion interaction logic
│   │   │   ├── onboarding.test.ts  # State machine, Notion query, and notification unit tests
│   │   │   └── bot.test.ts         # GrammY bot middleware and handler tests
│   │   └── notion/
│   │       ├── salesRepsService.ts # Notion CRUD for Sales Reps DB
│   │       └── salesRepsService.test.ts
```

## State Machine
```
[Unregistered User sends /start]
       │
       ▼
Ask Full Name (State: AWAITING_NAME)
       │
       ▼
Ask Phone Number (State: AWAITING_PHONE, provides Request Contact keyboard)
       │
       ▼
Ask Role (State: AWAITING_ROLE: "Sales Rep" | "Front Desk")
       │
       ▼
Save to Notion Sales Reps DB (Status: "Pending Approval")
       │
       ▼
Notify Managers (Inline buttons: [Approve ✅] [Reject ❌])
       │
       ├── Manager clicks [Approve] ──> Update Notion to "Active", Alert Rep
       └── Manager clicks [Reject]  ──> Update Notion to "Inactive", Alert Rep
```

## Testing Strategy
- Unit tests with mock Notion client for:
  - Identifying existing Rep by Telegram ID (`Active`, `Pending Approval`, `Inactive`, `NotFound`).
  - Validation of Name, Phone (valid phone numbers), and Role.
  - Creation of Notion record with proper properties.
  - Manager approval callback parsing and status update.
- GrammY Context mock tests verifying:
  - `/start` routing based on user state.
  - Step progression in onboarding conversation.
  - Manager callback handling.

## Boundaries
- **Always do:**
  - Store Telegram ID as string in Notion `Telegram ID` title property.
  - Validate phone format before saving.
  - Wrap all Notion operations with `ResilientNotionClient`.
- **Ask first:**
  - Hardcoding manager IDs without environment variable fallback.
- **Never do:**
  - Allow an unapproved rep to access the Mini App.
  - Trust raw user input without sanitization.

## Success Criteria
1. `/start` command accurately identifies existing reps in Notion and responds appropriately according to their approval status.
2. New users can complete the multi-step onboarding flow.
3. Rep record is created in Notion `Sales Reps DB` with status `Pending Approval`.
4. Manager approval callbacks update Notion status and notify the user.
5. All test suites pass 100% green with zero TypeScript errors.
