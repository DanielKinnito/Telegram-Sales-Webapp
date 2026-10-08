# Spec: Milestone 7 - Automated Notification Cron & Inactivity Sweeper

## Objective
Implement Milestone 7 from `PRD.md` and `docs/ROADMAP.md` to keep sales reps and managers proactively informed without requiring manual status checks:
1. **Daily 9:00 AM Push Notification Worker**: Automatically scans Notion for customer follow-ups scheduled for the current day and sends personalized morning briefings to each active sales rep.
2. **7-Day Inactivity Deal Sweeper**: Detects stalled active deals that have had no logged activity or updates for 7 or more days, and dispatches actionable alert messages to the deal owner and managers.
3. Provide robust unit tests with Vitest using TDD, covering edge cases (no follow-ups, multiple reps, stalled deals, non-stalled deals).

## Tech Stack
- Runtime: Node.js (TypeScript ESM)
- Framework / Scheduler: `node-cron`
- Telegram Engine: GrammY (`grammy`)
- Datastore: Notion API via `ResilientNotionClient`
- Test Runner: Vitest (`vitest run`)

## Commands
- Build / Typecheck: `npm run typecheck`
- Test: `npm test`
- Dev Backend: `npm run dev:backend`

## Project Structure
```
backend/
├── src/
│   ├── modules/
│   │   ├── cron/
│   │   │   ├── cronService.ts        # Core business logic for morning briefing & sweeper
│   │   │   ├── cronService.test.ts   # Unit tests simulating Notion records and bot messages
│   │   │   └── scheduler.ts          # node-cron task registration & startup hook
```

## Detailed Mechanics

### 1. Daily 9:00 AM Morning Briefing (`runDailyFollowUpBriefing`)
- Queries `Sales Logs DB` for entries where `Activity Date` equals today (`YYYY-MM-DD`).
- Also checks active leads or assigned accounts requiring follow-up.
- Groups tasks by sales rep using rep relations or Telegram IDs.
- Sends formatted Telegram Markdown briefing:
  ```
  ☀️ *Good morning, [Rep Name]! Daily Sales Briefing*

  📅 *Date:* [YYYY-MM-DD]
  📋 *Scheduled Follow-ups for Today:*
  • *[Company Name]* — [Interaction Type]
    Note: [Note Content]

  🚀 Have a productive day! Open the Sales Mini App to log updates.
  ```
- If a rep has zero follow-ups scheduled for today, sends a friendly check-in with pending leads count.

### 2. 7-Day Inactivity Sweeper (`runInactivitySweeper`)
- Queries `Deals DB` for active deals (`Stage` is NOT "Won" and NOT "Lost").
- Evaluates the deal's last interaction date from `Sales Logs DB` or `last_edited_time`.
- If `daysSinceLastActivity >= 7`:
  - Flags deal as stalled.
  - Sends warning push notification to the assigned sales rep:
    ```
    ⚠️ *Stalled Deal Alert: 7+ Days Inactivity*

    • *Deal:* [Deal Title]
    • *Amount:* ETB [Amount]
    • *Stage:* [Stage]
    • *Last Active:* [X days ago]

    _Please contact the client or log an activity update in the Mini App._
    ```
  - Sends summary alert to Managers if deal amount exceeds high-value threshold (e.g. >= ETB 200,000).

## Testing Strategy
- Unit Tests (`cronService.test.ts`):
  - Correct date filtering for today's follow-ups.
  - Rep grouping and message formatting.
  - Calculation of inactivity days (detects deals >= 7 days; ignores deals < 7 days; ignores won/lost deals).
  - Telegram Bot API spy verifies correct destination chat IDs and Markdown formatting.
  - Handles empty results gracefully without throwing.

## Boundaries
- **Always do:**
  - Wrap cron jobs in error boundaries so an individual rep delivery failure does not abort remaining briefings.
  - Use resilient Notion queries with rate limiting.
- **Never do:**
  - Send inactivity alerts for closed deals (`Won` or `Lost`).
  - Block server boot if cron initialization fails.
