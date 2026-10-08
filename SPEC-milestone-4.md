# Spec: Milestone 4 - Front Desk Walk-In Assignment (Workflow C)

## Objective
Implement Workflow C from `PRD.md` to support front-desk walk-in intake and automated round-robin lead distribution:
1. Provide an assignment engine querying active sales reps from `Rotational Queue DB` in Notion.
2. Filter for reps with `Availability Status == "Available"`, sorted by `Last Assigned Timestamp` ascending (oldest assignment first).
3. Verify that the customer TIN is strictly 10 digits and unique (using `LeadsService` and `TinCache`).
4. Assign the walk-in account to the selected sales rep, update their `Last Assigned Timestamp` in Notion, and link the account in `Accounts DB`.
5. Dispatch an instant Telegram push notification to the assigned sales rep with lead metadata.
6. Provide full test coverage with Vitest using TDD.

## Tech Stack
- Runtime: Node.js (TypeScript ESM)
- Framework: Express 5 (`express`)
- Telegram Engine: GrammY (`grammy`)
- Datastore: Notion API via `ResilientNotionClient`
- Validation: Zod (`tinValidator.ts`, `zod`)
- Test Runner: Vitest (`vitest run`)

## Project Structure
```
backend/
├── src/
│   ├── modules/
│   │   ├── queue/
│   │   │   ├── queueService.ts       # Round-robin selection & Rotational Queue DB sync
│   │   │   ├── queueService.test.ts  # Queue selection & timestamp ordering unit tests
│   │   │   ├── queueRoutes.ts        # POST /api/queue/assign route handler
│   │   │   └── queue.test.ts         # HTTP integration tests
```

## API Contract: `POST /api/queue/assign`

**Headers:**
`Authorization: tma <rawInitData>`

**Request Body:**
```json
{
  "companyName": "Ethio Corp",
  "tin": "0098765432",
  "address": "Bole Road, Addis Ababa",
  "industry": "Manufacturing",
  "contactName": "Abebe Tesfaye",
  "contactPhone": "+251911223344"
}
```

**Security & Authorization:**
- Validates Telegram HMAC `initData`.
- Verifies calling user is an `Active` staff member in Notion `Sales Reps DB` (Front Desk, Manager, or Sales Rep).

**Success Response (201 Created):**
```json
{
  "success": true,
  "account": {
    "pageId": "...",
    "companyName": "Ethio Corp",
    "tin": "0098765432",
    "assignedDate": "2026-10-08",
    "assignedRep": {
      "pageId": "...",
      "telegramId": "61917289",
      "fullName": "Tester One"
    }
  },
  "notificationSent": true
}
```

**Conflict / Validation Errors:**
- `400 Bad Request` if TIN is not 10 digits (`^\d{10}$`) or companyName is missing.
- `403 Forbidden` if caller is not an Active staff member.
- `409 Conflict` if TIN already exists in Accounts DB.
- `422 Unprocessable Entity` if no sales reps are currently `Available` in the rotational queue.

## Round-Robin Logic
1. Query `Rotational Queue DB` with:
   - Filter: `Availability Status == "Available"`
   - Sort: `Last Assigned Timestamp` ascending.
2. If results empty, throw `NoAvailableRepsError`.
3. Select first rep from sorted results.
4. Retrieve rep details from `Sales Reps DB` (for full name and telegram ID).
5. Update `Last Assigned Timestamp` on the Queue record in Notion to `new Date().toISOString()`.
6. Create Account in `Accounts DB` with `Owner` relation pointing to assigned rep.
7. Seed `TinCache` with the new account.
8. If contact details provided, create record in `Contacts DB` linked to the account.
9. Push instant message via GrammY `bot.api.sendMessage(assignedRep.telegramId, ...)`:
   > 🔔 **New Walk-In Lead Assigned!**  
   > • Company: Ethio Corp  
   > • TIN: 0098765432  
   > • Assigned by: Front Desk  
   > Open the Sales Mini App to view details and follow up.

## Testing Strategy
- Unit tests:
  - Round-robin ordering (reps with oldest timestamp chosen first; reps with null/empty timestamp chosen first).
  - Handles empty queue (throws descriptive error).
  - Updates timestamp on queue page after assignment.
  - Sends push notification via Telegram Bot API spy.
- HTTP Integration tests:
  - 401 unauthorized.
  - 400 validation error on invalid TIN.
  - 409 conflict on duplicate TIN.
  - 201 successful assignment + Telegram message sent.

## Boundaries
- **Always do:**
  - Verify HMAC signature on intake route.
  - Enforce 10-digit TIN uniqueness before assigning.
  - Update queue timestamp immediately to preserve fairness.
- **Never do:**
  - Assign to an `Offline` or `Busy` rep.
  - Fail the account creation if Telegram notification fails (log error and return `notificationSent: false`).
