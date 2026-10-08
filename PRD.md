# Product Requirements Document (PRD)

## Target Audience & Roles
1. Sales Reps (6): Use Telegram Mini App on mobile for lead creation, TIN checks, follow-ups, and deposit receipt uploads.
2. Front Desk (1): Uses specialized Receptionist view in Mini App to register walk-ins and route via round-robin.
3. Managers (3): Work in Notion Cockpit (Kanban boards, gallery views, audit tables) with zero custom admin UI needed.

## Core Workflows & Logic

### Workflow A: Sales Rep Onboarding
1. Rep opens Telegram bot and issues `/start`.
2. Backend checks `Sales Reps DB` for matching `telegram_id`.
3. If not found, Bot displays an onboarding registration form (Full Name, Phone).
4. System creates record with Status = `Pending Approval`.
5. Alert sent to Managers in Telegram to approve.

### Workflow B: TIN Duplicate & Conflict Prevention
1. Rep clicks "New Lead" in TWA and enters customer TIN (must be strictly 10 numeric digits, formatted as `^\d{10}$`).
2. TWA frontend validates 10-digit format before submitting; backend enforces 10-digit format.
3. Backend checks cache / queries `Accounts DB` for existing TIN.
4. If Match Found: Block registration immediately. Display:
   > "Company registered under [Sales Rep Name] on [Date]. Duplicate registration blocked. Please contact [Sales Rep Name] for internal transfers."
5. If No Match: Unlock lead form and proceed to registration.

### Workflow C: Front Desk Walk-In Assignment (Round-Robin)
1. Receptionist inputs Company Name and TIN (validated as 10 numeric digits).
2. System confirms TIN is unique.
3. System fetches active reps from `Rotational Queue DB` with status = `Available`, ordered by `Last Assigned Timestamp` ascending.
4. Lead is assigned to the selected rep, timestamp is updated, and an instant push notification is sent to the rep's Telegram.

### Workflow D: Purchase & Payment Proof Logging
1. Rep selects deal in Mini App and clicks "Log Purchase".
2. Rep enters Deposit Reference Number and attaches photo proof.
3. Image uploads to S3/R2 storage; public URL saved to Deal in Notion.
4. Stage updates to `Payment Pending Verification` and notifies Managers.

### Automated Notifications (Cron)
- Daily 9:00 AM: Push summary of leads scheduled for follow-up today.
- Inactivity Sweep: Alert if an active deal has had no logged activity for 7 days.