# User Operations Field Manual & IT Runbook
## Enterprise B2B Sales Operations Platform & Relational CRM

**Document Reference:** OPS-MANUAL-2026-V1  
**Target Roles:** Sales Representatives, Front Desk Receptionist, Executive Managers, and IT Operations  
**Platform Architecture:** Telegram Mini App (TWA) + GrammY Bot Engine + Notion Relational Datastores  
**Engineering Standard:** Enterprise Production Ready  

---

## 1. Operational Overview & Role Matrix

This manual provides the step-by-step operating procedures for all human roles interacting with the enterprise sales operations platform. The system is designed around role-specific interfaces:

| Operational Role | Primary Interface | Primary Responsibilities |
| :--- | :--- | :--- |
| **Field Sales Representatives (6)** | Telegram Mini App (Mobile) | On-site 10-digit TIN conflict checks, account registration, activity logging, and bank payment link submissions. |
| **Front Desk Receptionist (1)** | Telegram Mini App (Reception Console) | Processing headquarters walk-in visitors, validating customer TINs, and triggering automated round-robin lead distribution. |
| **Executive Managers (3)** | Notion Relational Workspace (Desktop / Tablet) | Approving new staff registrations, auditing bank payment confirmation links, governing deal stages, and reallocating stalled accounts. |
| **IT & Systems Operations** | Terminal & Hosting Consoles | Environment configuration, Notion database schema provisioning, Telegram webhook routing, and platform maintenance. |

---

## 2. Section A: Field Sales Representative Operations Guide

### 2.1 Launching the Sales Mini App

Sales representatives interact with the platform directly within Telegram on iOS or Android devices without installing separate software packages or configuring VPN connections.

1. Open Telegram and navigate to the official corporate sales bot (e.g., `@YourCompanySalesBot`).
2. Tap the persistent menu button labeled **💼 Open CRM** located at the bottom-left of the chat interface, or issue the `/app` command.
3. The platform opens the mobile web application and validates your profile automatically via cryptographic HMAC-SHA256 signature verification.
4. Your name, role (`Sales Rep`), and operational status are displayed in the header banner.

> **[SCREENSHOT REQUIRED: Mobile Telegram client chat view displaying the conversation with the corporate sales bot, highlighting the persistent '💼 Open CRM' button in the bottom-left corner and the initial authorized Mini App launch view]**

---

### 2.2 Verifying Lead Ownership & TIN Deduplication

Before pitching or registering any prospective enterprise account, representatives must verify that the customer is not actively assigned to a colleague.

1. Navigate to the **TIN Engine** tab in the bottom navigation bar.
2. Request the customer's legal ten-digit Taxpayer Identification Number (TIN) and enter it into the search field.
3. The interface enforces numeric formatting and verifies the 10-digit structure (`^\d{10}$`):
   * **State A — Account Collision Detected (Duplicate Registration Blocked):**
     If the account is already registered, an alert card appears in under 100 milliseconds:
     > *"Company registered under [Owner Name] on [Date]. Duplicate registration blocked. Please contact [Owner Name] for internal transfers."*
     **Action Required:** Do not prospect this account. If an account reassignment is warranted, contact executive management.
   * **State B — Account Available (TIN Clean):**
     If the account is unassigned, a green badge appears confirming availability:
     > *"✅ TIN Available — Ready for Registration"*
4. With the TIN confirmed available, enter the customer's **Company Name**, **Address**, and select the **Industry** from the dropdown menu.
5. Tap **Register Lead & Create Account**. The system commits the account directly to Notion and locks the TIN in the in-memory cache, preventing any other representative from registering the account.

> **[SCREENSHOT REQUIRED: Sales Mini App TIN Lookup view showing two states: 1) A collision alert banner displaying existing company name, assigned representative name, and registration date; 2) An available state showing the green checkmark and the opened lead creation form with Company Name and Industry fields filled out]**

---

### 2.3 Managing Accounts & Scheduling Follow-Up Calls

Once registered, accounts appear in the representative's active pipeline under the **Pipeline & Deals** tab.

1. Navigate to the **Pipeline & Deals** tab to view your assigned accounts and commercial deals.
2. Tap on any company card to open the comprehensive **Company Detail Modal**.
3. **Recording Client Contact Details:**
   * Enter the primary stakeholder's **Contact Person** name, **Direct Phone Number**, and **Position**.
   * If a third-party intermediary is involved, toggle the **Third Party Commission** checkbox and enter the beneficiary's name and phone number.
4. **Scheduling Follow-Up Activities:**
   * Under the **Schedule Follow-Up** section, select the interaction type: `Call`, `Meeting`, or `Note`.
   * Use the date picker to set the scheduled date and enter the target time (e.g., `10:30`).
   * Enter the discussion objective (e.g., *"Discuss revised commercial proposal and product volume requirements"*).
   * Tap **Save Activity**.
5. The system records the commitment in Notion's `Sales Logs DB`. For scheduled calls, the corporate bot dispatches an immediate confirmation to your Telegram chat and automatically triggers a reminder alert at the exact minute the call is due.

> **[SCREENSHOT REQUIRED: Company Detail Modal displaying client contact information, third-party commission toggle, and the 'Schedule Follow-Up' section with date/time pickers and activity type selector completed]**

---

### 2.4 Submitting Bank Payment Confirmation Links

When a customer completes a commercial down payment or contract deposit, representatives submit the digital confirmation link issued by the bank rather than uploading image screenshots.

1. Open the customer's deal in the **Pipeline & Deals** tab.
2. Tap the **Submit Payment Link** button located on the deal card.
3. Open the SMS or mobile banking application (e.g., Commercial Bank of Ethiopia CBE Birr / CBE Mobile, Telebirr, Dashen Bank Amole, or Bank of Abyssinia) and tap the native **Share Receipt** or **Copy Link** button.
4. Paste the URL (e.g., `https://cbe.et/tx/...` or `https://telebirr.et/...`) into the **Payment Proof Link** field.
5. Enter the deposit reference code or branch teller notes in the **Deposit Reference # / Note** field.
6. Tap **Submit Proof**.
7. The deal stage advances to `Payment Pending Verification` in Notion, and an immediate alert is dispatched to executive management for audit and one-click sign-off.

> **[SCREENSHOT REQUIRED: Payment Submission modal in the Mini App displaying the pasted bank confirmation HTTPS link, reference note input, and the confirmation notification displayed upon successful submission]**

---

### 2.5 Receiving Daily Morning Briefings & Precision Reminders

Representatives receive automated notifications directly within Telegram to guide daily commercial execution:

1. **Daily Morning Briefing (09:00 AM EAT):**
   * Every morning at 09:00 AM, the bot sends a briefing summarizing all client follow-ups, scheduled calls, and milestone deadlines assigned for the current business day.
   * Review the schedule and open the Mini App to execute morning outreach.
2. **Precision Call Reminders:**
   * When a scheduled call time arrives, the bot delivers an urgent push notification detailing the company name, contact person, phone number, and call objective.
   * Tap the customer's phone number directly within the message to initiate the call, then log discussion outcomes in the Mini App.

> **[SCREENSHOT REQUIRED: Telegram Messenger chat window showing the automated 09:00 AM morning sales briefing message with structured follow-up items, followed by a real-time call reminder notification]**

---

## 3. Section B: Front Desk Receptionist Operations Guide

### 3.1 Processing Inbound Walk-In Prospects

Walk-in visitors arriving at corporate headquarters must be logged and assigned without manual delay or perceived distribution bias.

1. Open Telegram and launch the Mini App via the **💼 Open CRM** button.
2. Navigate to the **Reception Walk-In** tab in the navigation bar.
3. Greet the visitor and politely request their business card or ten-digit commercial TIN.
4. Enter the visitor's ten-digit TIN into the **TIN Number** field:
   * **If the Account Belongs to an Existing Representative:**
     The screen displays the assigned representative's name and registration date.
     *Action:* Inform the visitor: *"Welcome back! Your designated account representative is [Representative Name]. I will notify them immediately of your arrival."* Contact the representative directly.
   * **If the Account is Unregistered (New Opportunity):**
     The interface unlocks the intake fields.
5. Complete the intake form:
   * **Company Name:** Legal enterprise name.
   * **Address:** Physical location or business premises.
   * **Industry:** Select the customer's primary commercial sector.
   * **Contact Person & Phone Number:** Visitor's direct name and mobile number.

> **[SCREENSHOT REQUIRED: Receptionist Walk-In console in the Mini App with completed fields for Company Name, 10-digit TIN, Address, Industry dropdown, and Contact Person]**

---

### 3.2 Executing Automated Round-Robin Queue Allocation

Once the intake form is completed, the distribution of the lead is handled by the platform's rotational algorithm.

1. Tap the **Register Walk-In & Assign Rep** button.
2. The platform queries the `Rotational Queue DB` for all sales representatives currently marked `Available`.
3. The engine selects the representative with the longest elapsed time since their last assignment (oldest `Last Assigned Timestamp`), or a representative who has not yet received an assignment.
4. The system executes atomic updates across Notion:
   * Creates the new Account with the selected representative as `Owner`.
   * Initializes a new Deal under stage `Proposal`.
   * Updates the representative's rotational queue timestamp to the current time.
   * Dispatches an instant push notification to the assigned representative's Telegram account.
5. The screen displays a confirmation dialog:
   > *"✅ Walk-In Successfully Assigned to [Representative Full Name]"*
6. Inform the visitor: *"Representative [Full Name] has been notified and is on their way to receive you in the meeting lounge."*

> **[SCREENSHOT REQUIRED: Walk-In intake confirmation dialog showing the assigned representative's name and the confirmation that an automated push notification was dispatched to their mobile device]**

---

## 4. Section C: Executive Manager Cockpit Guide (Notion CRM)

Executive Managers supervise commercial operations, audit digital payments, and manage team quotas directly within Notion without requiring custom administrative dashboards.

### 4.1 Governing the Deals Pipeline Kanban View

The primary cockpit for sales leadership is the **Deals / Pipeline** database in Notion.

1. Open Notion and navigate to the **Sales CRM Workspace** ➔ **Deals / Pipeline** database.
2. Select the **Pipeline Board** view (grouped horizontally by `Stage`).
3. Deals progress through six operational stages:
   * `New`: Initial qualification stage.
   * `Contacted`: Initial outreach completed.
   * `Proposal`: Commercial quote or product proposal delivered.
   * `Payment Pending Verification`: Customer has submitted a bank deposit share link.
   * `Won`: Contract finalized, deposit verified, fulfillment authorized.
   * `Lost`: Opportunity closed without commercial conversion.
4. Each deal card displays the Deal Title, Commercial Amount, Assigned Sales Representative, and Customer Account.
5. To advance a deal manually, drag the card between stage columns.

> **[SCREENSHOT REQUIRED: Notion Deals database displayed as a Kanban Board, grouped by Stage columns ('New', 'Contacted', 'Proposal', 'Payment Pending Verification', 'Won'), showing deal cards with commercial values and assigned rep names]**

---

### 4.2 Auditing & Approving Bank Payment Confirmation Links

When a representative logs a payment share link, managers verify the transaction and authorize deal completion.

1. Upon receiving an automated Telegram alert (*"💳 Bank Payment Transaction Link Submitted"*), click the link within Telegram or open Notion.
2. In the Notion **Deals / Pipeline** database, switch to the **Pending Payments Audit** table view (filtered where `Stage == Payment Pending Verification`).
3. Click the URL displayed in the **Payment Proof URL** column.
4. The browser opens the official, HTTPS-secured verification page hosted by the issuing bank (CBE, Telebirr, Dashen, or Bank of Abyssinia).
5. Verify that:
   * The transaction status indicates **Successful / Settled**.
   * The transferred amount matches or exceeds the agreed commercial down payment.
   * The payer or transaction description matches the customer's account records.
6. Once verified, drag the deal card to **Won** on the Kanban board, or update the `Stage` property dropdown to `Won`.
7. Revenue credit is immediately applied to the assigned sales representative.

> **[SCREENSHOT REQUIRED: Notion Deals table view filtered to 'Payment Pending Verification', displaying the clickable 'Payment Proof URL' column and deposit reference numbers alongside the deal title]**

---

### 4.3 Managing Sales Representative Shifts & Rotational Availability

To ensure the receptionist's walk-in queue operates fairly, managers adjust team availability states when representatives are on leave, travel, or dedicated assignments.

1. Open the **Rotational Queue** database in Notion.
2. Each representative record features an **Availability Status** select property:
   * `Available`: Eligible to receive walk-in assignments in turn order.
   * `Busy`: Temporarily attending to active clients; bypassed by the queue.
   * `Offline`: On leave, travel, or weekend rest; excluded from allocation.
3. If a representative reports sick or begins field travel, change their status to `Offline`. When they return, switch their status back to `Available`.
4. *Fairness Guarantee:* When a representative returns from leave, their prior `Last Assigned Timestamp` is preserved, ensuring they receive assignments in equitable sequence upon reactivation.

> **[SCREENSHOT REQUIRED: Notion Rotational Queue database showing representative names, status badges ('Available', 'Busy', 'Offline'), and the 'Last Assigned Timestamp' column]**

---

### 4.4 Resolving 7-Day Inactive Deals

When an active opportunity remains untouched for seven calendar days, leadership receives an automated notification to prevent pipeline decay.

1. Upon receiving an alert (*"⚠️ Stalled Deal Alert: 7+ Days Inactivity"*), open the deal record in Notion.
2. Inspect the linked **Sales Logs** property to view the interaction history and last logged notes.
3. If the assigned representative has failed to maintain contact, leadership can reassign the account:
   * Open the deal card and update the **Assigned Rep** relation to a new representative.
   * In the linked **Accounts** database, update the **Owner** property to match the new representative.
4. The newly assigned representative receives access to all prior interaction notes in the Mini App and can immediately resume client outreach.

---

## 5. Section D: IT Operations & Turnkey Handover Runbook

This section details the procedures required for the client company's IT operations team to provision, configure, deploy, and maintain the production environment.

### 5.1 Environment Prerequisites & Secret Inventory

The platform requires the following credentials and environment variables:

| Variable Name | Description | Source / Origin |
| :--- | :--- | :--- |
| `PORT` | HTTP port for the backend web service (Default: `3000`). | Hosting environment configuration. |
| `NODE_ENV` | Runtime environment (`production` or `development`). | Hosting environment configuration. |
| `TELEGRAM_BOT_TOKEN` | API token for the company Telegram bot. | Generated via `@BotFather` on Telegram. |
| `NOTION_API_KEY` | Internal integration secret (`ntn_...`). | Generated at `notion.so/profile/integrations`. |
| `NOTION_PARENT_PAGE_ID` | 32-character hex ID of the workspace parent page. | Extracted from the Notion parent page URL. |
| `NOTION_SALES_REPS_DB_ID` | Database ID for Sales Representatives. | Output of `npm run setup:notion`. |
| `NOTION_ACCOUNTS_DB_ID` | Database ID for Accounts (TIN Unique). | Output of `npm run setup:notion`. |
| `NOTION_DEALS_DB_ID` | Database ID for Commercial Deals. | Output of `npm run setup:notion`. |
| `NOTION_CONTACTS_DB_ID` | Database ID for Stakeholder Contacts. | Output of `npm run setup:notion`. |
| `NOTION_SALES_LOGS_DB_ID` | Database ID for Activity Logs. | Output of `npm run setup:notion`. |
| `NOTION_QUEUE_DB_ID` | Database ID for the Rotational Queue. | Output of `npm run setup:notion`. |
| `TELEGRAM_MANAGER_CHAT_IDS` | Comma-separated numeric IDs of Executive Managers. | Extracted via `@userinfobot` on Telegram. |
| `WEBAPP_URL` | Public HTTPS domain of the deployed Mini App. | Cloudflare Pages / Render frontend URL. |
| `STORAGE_PROVIDER` | Object storage driver (`supabase`, `s3`, `r2`, or `mock`). | Infrastructure configuration. |

---

### 5.2 Step 1: Telegram Bot Provisioning with `@BotFather`

1. Open Telegram and initiate a conversation with `@BotFather`.
2. Send `/newbot` and provide a friendly name (e.g., `Acme Sales Operations Portal`) and username (e.g., `acme_sales_ops_bot`).
3. Securely record the resulting `TELEGRAM_BOT_TOKEN`.
4. Configure bot descriptions and menu buttons using the included automated script:
   ```bash
   cd backend
   npx tsx scripts/setup-telegram-bot.ts https://crm.yourcompany.com
   ```
   *This command automatically sets the bot bio, short description, commands (`/start`, `/app`, `/help`), and binds the persistent menu button (`💼 Open CRM`) to your HTTPS domain.*

---

### 5.3 Step 2: Notion Internal Integration Provisioning

1. Navigate to [notion.so/profile/integrations](https://www.notion.so/profile/integrations) and click **New integration**.
2. Name the integration `Sales CRM Engine`, select your corporate workspace, and grant **Read**, **Update**, and **Insert** permissions.
3. Copy the **Internal Integration Secret** (`ntn_...`).
4. In Notion, create an empty parent page entitled **Sales CRM Workspace**.
5. In the top-right menu (`...`), click **Connect to** and select `Sales CRM Engine`.
6. Copy the page URL. The 32-character hexadecimal string at the end of the URL is the `NOTION_PARENT_PAGE_ID`.

---

### 5.4 Step 3: Automated Database Schema Provisioning

The repository includes automated provisioning scripts that create all six databases, apply two-way relationships, and register Notion Data Sources:

1. In the repository root, create your production configuration:
   ```bash
   cp .env.example .env
   ```
2. Populate `NOTION_API_KEY`, `NOTION_PARENT_PAGE_ID`, `TELEGRAM_BOT_TOKEN`, and `TELEGRAM_MANAGER_CHAT_IDS`.
3. Execute the base database generator:
   ```bash
   npm --prefix backend run setup:notion
   ```
   *This creates all six databases with their relational links and writes the generated database IDs to `.env.generated`.*
4. Synchronize data source property definitions:
   ```bash
   npm --prefix backend run setup:schemas
   ```
5. Merge the generated database IDs from `.env.generated` into your primary `.env` file.

---

### 5.5 Step 4: Hosting Deployment (Web Service & Static CDN)

#### Option A: Render Cloud Deployment (Recommended)
1. **Backend Web Service:**
   * Environment: Node.js (Version 22 LTS).
   * Root Directory: `backend`
   * Build Command: `npm install`
   * Start Command: `npm start`
   * Environment Variables: Insert all completed keys from `.env`.
2. **Frontend Static Site:**
   * Root Directory: `frontend`
   * Build Command: `npm install && npm run build`
   * Publish Directory: `dist`
   * Environment Variables: `VITE_API_URL=https://your-backend.onrender.com`

#### Option B: Docker Container Deployment
Use the included multi-stage Docker build:
```bash
docker build -t sales-crm-platform:latest .
docker run -d -p 3000:3000 --env-file .env sales-crm-platform:latest
```

---

### 5.6 Step 5: Initial Staff Roster Onboarding

1. Instruct the three Executive Managers to obtain their numeric Telegram User IDs (via `@userinfobot`) and verify they are listed in `TELEGRAM_MANAGER_CHAT_IDS`.
2. Direct all six Sales Representatives and the Front Desk Receptionist to open the Telegram bot and click `/start`.
3. Each team member enters their Full Name, Phone Number, and designates their Role.
4. Executive Managers receive inline notifications on Telegram and tap `✅ Approve` for each team member.
5. Once approved, staff members tap **💼 Open CRM** to immediately access their authorized mobile workspace.

---

### 5.7 Routine Maintenance & Health Monitoring

* **Health Endpoint:** The backend exposes an unauthenticated health check endpoint at `GET /health` returning service uptime and timestamp telemetry.
* **TIN Cache Verification:** To inspect cache status, monitor backend logs upon startup for:
  > `💾 In-memory TIN cache warmed up (N registered TINs loaded)`
* **Log Inspection:** Search application logs for `[RateLimiter]` or `[ResilientNotionClient]` to monitor API request throttling and transient retry events.
