#set page(
  paper: "a4",
  margin: (x: 2.5cm, top: 2.8cm, bottom: 2.5cm),
  header: [
    #set text(size: 8.5pt, fill: rgb("64748b"))
    #grid(
      columns: (1fr, 1fr),
      [B2B Sales Operations Platform --- Commercial & Technical Proposal],
      align(right)[Commercial-in-Confidence],
    )
    #line(length: 100%, stroke: 0.5pt + rgb("e2e8f0"))
  ],
  footer: [
    #line(length: 100%, stroke: 0.5pt + rgb("e2e8f0"))
    #v(2pt)
    #set text(size: 8.5pt, fill: rgb("64748b"))
    #grid(
      columns: (1fr, 1fr),
      [Document Reference: PROP-2026-B2B-CRM],
      align(right)[Page #context counter(page).display("1 of 1", both: true)],
    )
  ]
)

#set text(
  font: ("Inter", "SF Pro Text", "Helvetica Neue", "Arial", "Liberation Sans"),
  size: 10pt,
  fill: rgb("0f172a"),
  lang: "en",
)

#set par(justify: true, leading: 0.65em)
#set heading(numbering: "1.1")

#show heading: it => [
  #v(12pt, weak: true)
  #text(fill: rgb("0f172a"), weight: "bold")[#it]
  #v(6pt, weak: true)
]

#show heading.where(level: 1): it => [
  #v(16pt, weak: true)
  #text(fill: rgb("0284c7"), weight: "bold", size: 14pt)[#it]
  #v(8pt, weak: true)
]

#show heading.where(level: 2): it => [
  #v(12pt, weak: true)
  #text(fill: rgb("1e293b"), weight: "bold", size: 11.5pt)[#it]
  #v(6pt, weak: true)
]

// Title & Cover Metadata
#align(center)[
  #v(10pt)
  #text(size: 20pt, weight: "bold", fill: rgb("0f172a"))[Commercial & Technical Proposal]
  #v(4pt)
  #text(size: 13pt, weight: "medium", fill: rgb("0284c7"))[B2B Sales Operations Platform & Notion CRM Integration]
  #v(12pt)
]

#block(
  fill: rgb("f8fafc"),
  stroke: 1pt + rgb("e2e8f0"),
  inset: 12pt,
  radius: 6pt,
  width: 100%,
  [
    #grid(
      columns: (1fr, 1fr),
      row-gutter: 8pt,
      [#text(weight: "bold")[Document Reference:] PROP-2026-B2B-CRM],
      [#text(weight: "bold")[Date:] October 2026],
      [#text(weight: "bold")[Classification:] Commercial-in-Confidence],
      [#text(weight: "bold")[Prepared By:] Solutions Architecture Team],
      [#text(weight: "bold")[Target Audience:] Executive Leadership & IT],
      [#text(weight: "bold")[Status:] Proposal Submission],
    )
  ]
)

#v(12pt)

== Executive Summary

To the Executive Leadership and Commercial Directorate:

In enterprise B2B sales, team performance depends on three fundamentals: clear account ownership, fast response to prospects, and real-time visibility into active deals. When sales operations rely on manual coordination, human delays slow down sales cycles, create friction between representatives, and cause customer drop-off.

This proposal outlines the technical architecture, operating workflows, and commercial terms for a dedicated B2B Sales Operations Platform. Built for Ethiopian business operations, the platform pairs a lightweight Telegram Mini App for field staff with a relational CRM hosted in Notion for executive management.

By tying account ownership to the customer's legal 10-digit Taxpayer Identification Number (TIN), the platform eliminates the need for representatives to check client availability in group chats. Account collisions and commission disputes are prevented before they occur. Walk-in visitors at company headquarters are assigned through an automated round-robin queue, and customer deposits are verified using official mobile banking confirmation links.

The platform provides management with continuous pipeline visibility, gives sales representatives instant clarity in the field, and shortens payment verification from days to minutes.

= The Business Case

== Current Operational Bottlenecks

In enterprise sales, timing is critical during the initial meeting with a prospect. Today, that momentum is lost to administrative uncertainty. When a sales representative identifies a new enterprise lead, they have no direct way to confirm whether another team member is already working with the account.

To avoid duplicate outreach, the representative must post the company name into a group chat and wait for colleagues to reply. Inquiries routinely sit unanswered for hours while colleagues are in meetings, traveling, or on client sites. The representative must either keep the client waiting or pitch the account at the risk of duplicating a colleague's work.

This delay leads directly to account collisions. When team members miss a chat message, two representatives can pitch the same customer under different pricing or terms. When the customer signs, management must arbitrate internal arguments over who originated the deal and earned the commission. These disputes hurt team morale, encourage representatives to hide leads in personal notebooks, and make the company look disorganized to customers.

A similar bottleneck occurs at corporate headquarters when walk-in clients arrive unannounced. Reception staff must spend fifteen to thirty minutes calling representatives to see who is on site and available. This manual assignment invites perceived favoritism among staff, leaves visiting clients waiting in the lobby, and leads to lost leads when visitor notes are recorded on paper slips.

Finally, payment verification slows down deal closing. When a customer pays a deposit by bank transfer, representatives circulate screenshots of paper deposit slips or mobile confirmation screens. Management must manually reconcile these images against bank account statements, causing delays of 24 to 72 hours before orders can be approved. These delays frustrate paying clients and obscure the company's daily cash position.

== Proposed Resolution

The platform resolves these bottlenecks by replacing manual chat inquiries with an automated verification system. Account ownership is tied directly to the customer's legal 10-digit Ethiopian Taxpayer Identification Number (TIN).

When a sales representative enters a prospect's TIN into the Mini App, an in-memory cache checks the database in under 100 milliseconds. If the account is already registered, the app immediately displays the company name, the assigned representative, and the registration date. Duplicate registration is blocked automatically. If the TIN is unassigned, the representative claims ownership with a single tap, saving the account directly to Notion.

At corporate reception, walk-in visitors are processed through an intake console. The system verifies that the visitor is not an existing client, checks which representatives are active and available, and assigns the lead to the representative whose turn is oldest. The assigned representative receives an instant push notification on their phone, and the visitor is received in the lobby without delay.

Payment verification is streamlined using digital receipts from Ethiopian financial institutions. When a customer transfers funds via Commercial Bank of Ethiopia (CBE), Telebirr, Dashen Bank, or Bank of Abyssinia, the bank issues an official web confirmation link. Representatives paste this link into the Mini App, which updates the deal status and notifies management. Managers tap the link to view the bank's hosted confirmation page and approve the deal in Notion with a single click.

#figure(
  caption: [Workflow Comparison: Status Quo Manual Delays vs. Instant TIN Verification],
)[
```mermaid
graph TD
    subgraph CurrentState ["Current Status Quo: Manual Delays"]
        A1["Rep meets prospect on site"] --> B1["Posts company name in group chat"]
        B1 --> C1["Waits 1 to 4 hours for replies"]
        C1 --> D1{"Does everyone respond?"}
        D1 -- "No" --> E1["Account collision & commission dispute"]
        D1 -- "Yes" --> F1["Delayed outreach & lost momentum"]
    end

    subgraph ProposedState ["Platform Workflow: Instant Verification"]
        A2["Rep meets prospect on site"] --> B2["Inputs 10-digit TIN in Mini App"]
        B2 --> C2["System checks database in < 100ms"]
        C2 --> D2{"TIN already registered?"}
        D2 -- "Yes" --> E2["Registration blocked with owner details"]
        D2 -- "No" --> F2["Instant ownership & deal created in Notion"]
    end
```
] <fig-workflow-comparison>

== Expected Operational Improvements

#table(
  columns: (1.5fr, 2.2fr, 2fr, 2.3fr),
  stroke: 0.5pt + rgb("cbd5e1"),
  fill: (col, row) => if row == 0 { rgb("f1f5f9") } else { none },
  align: (col, row) => if row == 0 { center + horizon } else { left + horizon },
  [*Operational Area*], [*Current Status Quo*], [*Target Platform State*], [*Business Impact*],
  [Lead Conflict Resolution], [30 mins to 4 hours waiting for chat replies], [Under 100 ms via in-memory lookup], [Eliminates account collisions and commission disputes],
  [Walk-In Lead Assignment], [15 to 45 mins of calls and lobby waiting], [Under 3 seconds via automated queue], [Impartial distribution; zero lobby wait time for visitors],
  [Payment Verification], [24 to 72 hours matching slips to statements], [Instant push alert with bank link], [Same-day audit; orders released within minutes],
  [Pipeline Reporting], [4 to 8 hours weekly compiling spreadsheets], [Real-time Kanban pipeline in Notion], [Eliminates manual weekly sales reporting],
  [Daily Sales Routine], [Irregular, informal morning check-ins], [Automated 09:00 AM EAT Telegram briefings], [Daily follow-ups and due calls delivered to reps],
  [Stalled Deal Intervention], [End-of-month manual reviews], [Automated 7-day inactivity alerts to managers], [Earlier intervention on at-risk deals],
)

= Technical Architecture & Infrastructure

== System Design

The architecture is built on three core requirements: low friction for mobile field staff, cryptographic security on every request, and reliable database synchronization.

Field staff do not need to install dedicated apps or configure VPNs. The interface runs as a Telegram Mini App directly inside Telegram on iOS and Android. This provides fast loading and a familiar interface that staff already use daily.

Security is enforced at the API gateway. The platform does not trust client-submitted user IDs. Every request from the Mini App includes a cryptographic signature generated by Telegram. The backend validates this signature using HMAC-SHA256 and the bot's secret key. Sessions older than 24 hours are rejected automatically.

Data is stored in Notion as a relational CRM. This gives management access to Kanban boards, tables, and audit logs without the expense of building a custom admin portal. Because Notion limits API traffic to three requests per second, the backend uses a queue rate limiter and automatic retries with exponential backoff to handle rate limits and temporary network errors.

#figure(
  caption: [Full-Stack System Architecture: Client Layer, Security Gateway, Backend Services, and Notion Datastores],
)[
```mermaid
graph TB
    subgraph ClientTier ["Client Interface Layer"]
        TMA["Telegram Mini App (React 19 + Vite 8)<br/>Mobile Interface & Telegram SDK"]
        TG_BOT["Telegram Bot (GrammY Engine)<br/>Staff Onboarding & Manager Alerts"]
    end

    subgraph SecurityGateway ["Security Gateway"]
        HMAC_GUARD["HMAC-SHA256 Auth Middleware<br/>Signature & Expiration Validation"]
    end

    subgraph ServiceLayer ["Backend Service Layer (Express 5)"]
        AUTH_SVC["Authentication & Profile Service"]
        LEADS_SVC["Leads & TIN Validation Service"]
        QUEUE_SVC["Rotational Queue Service"]
        DEALS_SVC["Deals & Payment Service"]
        CRON_SVC["East Africa Time Cron Workers"]
        TIN_CACHE[("In-Memory TIN Cache")]
        STORAGE_ADP["Modular Storage Adapter"]
    end

    subgraph DatastoreTier ["CRM Datastore Layer (Notion API v5)"]
        RESILIENT_CLIENT["Resilient Notion Client (3 req/sec Rate Limiter)"]
        DB_REPS[("Sales Reps DB")]
        DB_ACCOUNTS[("Accounts DB (TIN Unique)")]
        DB_DEALS[("Deals & Pipeline DB")]
        DB_QUEUE[("Rotational Queue DB")]
        DB_LOGS[("Sales Logs DB")]
        DB_CONTACTS[("Contacts DB")]
    end

    TMA -->|"Authorization: tma <initData>"| HMAC_GUARD
    HMAC_GUARD --> AUTH_SVC
    HMAC_GUARD --> LEADS_SVC
    HMAC_GUARD --> QUEUE_SVC
    HMAC_GUARD --> DEALS_SVC

    TG_BOT <-->|"Bot Updates & Alerts"| ServiceLayer

    LEADS_SVC <--> TIN_CACHE
    LEADS_SVC --> RESILIENT_CLIENT
    QUEUE_SVC --> RESILIENT_CLIENT
    DEALS_SVC --> RESILIENT_CLIENT
    CRON_SVC --> RESILIENT_CLIENT
    DEALS_SVC -.-> STORAGE_ADP

    RESILIENT_CLIENT --> DB_REPS
    RESILIENT_CLIENT --> DB_ACCOUNTS
    RESILIENT_CLIENT --> DB_DEALS
    RESILIENT_CLIENT --> DB_QUEUE
    RESILIENT_CLIENT --> DB_LOGS
    RESILIENT_CLIENT --> DB_CONTACTS

    QUEUE_SVC -->|"Rep Push Notification"| TG_BOT
    DEALS_SVC -->|"Manager Audit Alert"| TG_BOT
    CRON_SVC -->|"Morning Briefing & Inactivity Alerts"| TG_BOT
```
] <fig-system-architecture>

== Technology Stack

- *Frontend Client:* Built with React 19, TypeScript, and Vite 8. The UI uses standard mobile design conventions with Tailwind CSS v4, supporting touch gestures, clear card layouts, and responsive navigation. Telegram integration is handled by `@telegram-apps/sdk-react` v3.3.9.
- *Backend Application:* Runs on Node.js using Express 5. Telegram bot commands, conversational onboarding, and notification alerts use GrammY (`grammy` v1.46.0). Automated background jobs use `node-cron` scheduled in East Africa Time (`Africa/Addis_Ababa`, UTC+3).
- *CRM Datastore:* Hosted in Notion via `@notionhq/client` v5.27.0. A custom client wrapper enforces a strict limit of 3 requests per second to comply with Notion API limits, with exponential backoff retries for transient errors. Instant duplicate TIN lookups are handled by an in-memory cache loaded at server startup.
- *File Storage:* Storage uses an adapter interface configured for Supabase Storage (`@supabase/supabase-js` v2.117.3), with drop-in support for AWS S3 and Cloudflare R2.

= Operational Workflows

== Staff Onboarding and Access Control

Access is restricted to authorized team members. When a new sales representative or receptionist opens the company Telegram bot and sends `/start`, the system checks the `Sales Reps DB`. If the user is not found, the bot guides them through registration. The user enters their full name, shares their phone number, and selects their role.

The system creates a pending record in Notion and sends an approval alert with action buttons to executive managers on Telegram. Until a manager approves the account, the user cannot access the Mini App. Once approved, the record status updates to active in Notion, and the bot notifies the user that their account is ready.

Every API request from the Mini App is verified using HMAC-SHA256 signature checking. The backend verifies the session hash against the bot token, confirms that the request has not been tampered with, and checks that the session timestamp is less than 24 hours old. User identity is taken strictly from the verified signature, ignoring any user IDs passed in plain request bodies.

#figure(
  caption: [Staff Onboarding and Cryptographic HMAC Authentication Flow],
)[
```mermaid
sequenceDiagram
    autonumber
    actor Staff as New Team Member
    participant Bot as Corporate Telegram Bot
    participant Backend as Backend Gateway
    participant Notion as Notion (Sales Reps DB)
    actor Mgr as Executive Manager
    actor Rep as Active Representative
    participant TMA as Telegram Mini App

    Staff->>Bot: Sends /start
    Bot->>Notion: Checks Telegram ID in Sales Reps DB
    Notion-->>Bot: No record found
    Bot-->>Staff: Prompts for Name, Phone, and Role
    Staff->>Bot: Submits profile information
    Bot->>Notion: Creates record (Status = Pending Approval)
    Notion-->>Bot: Record created
    Bot-->>Staff: Confirms submission is pending approval
    Bot->>Mgr: Sends alert with [Approve] and [Reject] buttons
    Mgr->>Bot: Clicks [Approve]
    Bot->>Notion: Updates record (Status = Active)
    Bot-->>Staff: Notifies user that account is approved

    Note over Rep,TMA: Daily Access via Telegram Mini App
    Rep->>TMA: Taps 'Open CRM' menu button
    TMA->>Backend: GET /api/auth/me (Authorization: tma <initData>)
    Backend->>Backend: Validates HMAC-SHA256 signature
    Backend->>Notion: Checks representative status
    Notion-->>Backend: Confirms active status and role
    Backend-->>TMA: Returns authorized profile data
    TMA-->>Rep: Displays personalized dashboard
```
] <fig-staff-onboarding>

== TIN Deduplication and Account Registration

The conflict prevention engine uses the 10-digit Taxpayer Identification Number issued to all registered businesses in Ethiopia. The Mini App validates the input format before sending the request, preventing incomplete numbers from reaching the server.

When a representative enters a TIN, the backend checks the in-memory cache. If the number already exists in the system, the server returns the registered company name, the representative who owns the account, and the original registration date. The Mini App displays this conflict information and blocks registration, preventing duplicate entries.

If the TIN is unassigned, the app confirms availability and allows the representative to enter the company name, address, and industry. When submitted, the backend saves the account to Notion, links the representative as owner, and updates the in-memory cache immediately. This immediate update ensures that if two representatives query the same unassigned company at the same time, the first submission reserves the account, and the second is blocked.

#figure(
  caption: [TIN Deduplication and Account Registration Sequence],
)[
```mermaid
sequenceDiagram
    autonumber
    actor Rep as Sales Representative
    participant TMA as Mini App TIN Engine
    participant API as Backend Leads Router
    participant Cache as In-Memory TinCache
    participant Notion as Notion Accounts DB

    Rep->>TMA: Inputs 10-digit TIN (e.g., 0012345678)
    TMA->>TMA: Validates 10-digit format
    TMA->>API: GET /api/leads/check-tin?tin=0012345678
    API->>API: Sanitizes input
    API->>Cache: Checks cache for TIN

    alt Account Already Registered
        Cache-->>API: Returns existing account details
        API-->>TMA: Returns conflict details (Owner, Company, Date)
        TMA-->>Rep: Displays conflict card and blocks registration
    else Unassigned Account
        Cache-->>API: No record in cache
        API->>Notion: Queries Accounts DB for TIN
        Notion-->>API: No matching records found
        API-->>TMA: Confirms TIN is available
        TMA-->>Rep: Displays green checkmark and unlocks form
        Rep->>TMA: Enters company details and taps Register
        TMA->>API: POST /api/leads with account payload
        API->>Notion: Creates Account in Notion with Rep as Owner
        Notion-->>API: Returns new record ID
        API->>Cache: Adds TIN and metadata to cache
        API-->>TMA: Returns success response
        TMA-->>Rep: Displays confirmation and opens deal profile
    end
```
] <fig-tin-deduplication>

== Walk-In Intake and Round-Robin Queue

Walk-in visitors arriving at company headquarters are processed through an intake console at the reception desk. The receptionist collects the visitor's company name and 10-digit TIN. The system performs an instant check. If the visitor is from an existing account, the screen displays the assigned representative's name so the receptionist can contact them directly.

If the account is new, the receptionist enters the visitor's contact details and clicks to assign the lead. The backend checks the rotational queue database for sales representatives who are active and marked as available. The allocation algorithm uses two priority tiers: representatives who have never received an assignment receive first priority, followed by representatives whose last assignment timestamp is oldest.

Once a representative is selected, the system updates their queue timestamp to the current time, creates the account in Notion with that representative as owner, and initializes a deal in the proposal stage. The system sends an instant push notification with the visitor's details to the assigned representative's phone. The receptionist can immediately inform the visitor that their representative has been notified and is coming to receive them.

#figure(
  caption: [Walk-In Intake and Round-Robin Queue Allocation Sequence],
)[
```mermaid
sequenceDiagram
    autonumber
    actor Rec as Front Desk Receptionist
    participant TMA as Mini App Reception Console
    participant API as Backend Queue Router
    participant Notion as Notion CRM Datastores
    participant Bot as Corporate Telegram Bot
    actor Rep as Selected Sales Representative

    Rec->>TMA: Enters walk-in details (Company, TIN, Contacts)
    TMA->>API: POST /api/queue/walkin
    API->>API: Verifies TIN is unassigned
    API->>Notion: Queries Queue DB for Available reps
    Notion-->>API: Returns list of available reps and timestamps
    API->>API: Selects rep with oldest assignment timestamp
    API->>API: Chooses next eligible representative

    par Commit Updates to Notion
        API->>Notion: Updates rep timestamp to current time
        API->>Notion: Creates Account in Notion with rep as owner
        API->>Notion: Creates initial Deal in Proposal stage
    end

    API->>Bot: Sends push alert to selected rep's Telegram
    Bot->>Rep: Delivers alert with walk-in company details
    API-->>TMA: Returns confirmation with assigned rep name
    TMA-->>Rec: Displays confirmation dialog
```
] <fig-walkin-round-robin>

== Payment Link Verification and Manager Sign-Off

Payment verification uses digital receipts from Ethiopian financial institutions. When a customer pays a deposit via mobile banking or branch transfer, the bank generates an official transaction receipt link via SMS or mobile app.

The sales representative copies this link and pastes it into the deal's payment modal in the Mini App, along with the deposit reference code or teller note. The backend validates that the link is a valid HTTPS web address, updates the deal stage to `Payment Pending Verification` in Notion, and saves the link in the deal record. The system then broadcasts an alert to executive managers on Telegram.

The alert provides managers with the deal name, customer, deposit amount, and a direct button linking to the bank's receipt page. The manager taps the link on their phone or computer to verify the deposit on the bank's website. Once verified, the manager drags the deal card to `Won` in Notion, completing the sale and releasing the order for fulfillment.

#figure(
  caption: [Payment Link Verification and Executive Sign-Off Flow],
)[
```mermaid
sequenceDiagram
    autonumber
    actor Rep as Sales Representative
    participant TMA as Mini App Payment Modal
    participant API as Backend Deals Router
    participant Notion as Notion Deals DB
    participant Bot as Corporate Telegram Bot
    actor Mgr as Executive Manager

    Rep->>TMA: Opens Deal and taps Submit Payment Proof
    Rep->>TMA: Pastes bank share link and reference note
    TMA->>API: POST /api/deals/payment-proof
    API->>API: Validates HTTPS link format
    API->>Notion: Updates Deal: Stage = Payment Pending Verification
    Notion-->>API: Record updated
    API->>Bot: Sends alert to Executive Managers
    Bot->>Mgr: Telegram alert with direct link to bank receipt
    API-->>TMA: Returns success confirmation
    TMA-->>Rep: Shows confirmation toast

    Mgr->>Mgr: Clicks link to verify receipt on bank portal
    Mgr->>Notion: Moves deal card to Won on Notion Kanban board
```
] <fig-payment-verification>

== Automated Notifications and Reminders

The platform includes background scheduled jobs running in East Africa Time (UTC+3) to keep daily operations on track without manual monitoring:

- *Daily Follow-Up Briefing (09:00 AM EAT):* Checks the sales logs database for all calls, meetings, and follow-ups scheduled for the current day. The service groups these activities by representative and sends each representative a morning briefing on Telegram with their daily schedule.
- *Inactivity Sweeper (10:00 AM EAT):* Checks active deals in the pipeline that have not been closed. If a deal has had no logged activity for seven or more days, the service sends an alert to executive managers with the deal title, value, assigned representative, and days of inactivity. Management can then follow up with the representative or reassign the account.
- *Call Reminders (Every 60 Seconds):* Runs every minute to check for calls scheduled for the current day where a reminder has not yet been sent. When the scheduled minute arrives, the service sends an instant push notification to the representative's phone with the client name, contact number, and call objective.

#figure(
  caption: [Automated Scheduled Notifications and Inactivity Alert Architecture],
)[
```mermaid
sequenceDiagram
    autonumber
    participant Cron as Background Scheduler (UTC+3)
    participant Service as Cron Service
    participant Notion as Notion CRM Datastores
    participant Bot as Corporate Telegram Bot
    actor Rep as Sales Representative
    actor Mgr as Executive Manager

    Note over Cron: 09:00 AM East Africa Time (06:00 UTC)
    Cron->>Service: Triggers Daily Follow-Up Briefing
    Service->>Notion: Queries Sales Logs DB for today's activities
    Notion-->>Service: Returns scheduled calls and follow-ups
    Service->>Service: Groups activities by representative
    loop For Each Representative
        Service->>Bot: Sends morning briefing message
        Bot->>Rep: Delivers daily schedule to rep's Telegram
    end

    Note over Cron: 10:00 AM East Africa Time (07:00 UTC)
    Cron->>Service: Triggers Inactivity Sweeper
    Service->>Notion: Queries Deals DB for active opportunities
    Notion-->>Service: Returns open deals
    Service->>Service: Filters deals inactive for 7 or more days
    loop For Each Inactive Deal
        Service->>Bot: Sends inactivity alert to management
        Bot->>Mgr: Delivers alert with deal details and days idle
    end
```
] <fig-scheduled-notifications>

= User Journey Overviews

== Field Sales Representative Journey

The field workflow focuses on speed and simplicity during client visits:

#figure(
  caption: [Field Sales Representative Experience and Customer Journey],
)[
```mermaid
journey
    title Field Sales Representative Customer Site Experience
    section Lead Qualification
      Arrive at client site: 5: Rep
      Open Mini App in Telegram: 5: Rep
      Enter 10-digit TIN: 5: Rep
      Verify ownership in under 100ms: 5: Rep, System
    section Account Registration
      Complete company and contact details: 4: Rep
      Save account to Notion: 5: Rep, System
      Schedule next-day follow-up call: 5: Rep
    section Closing & Payment
      Customer pays via mobile banking: 5: Rep, Client
      Copy transaction share link from SMS: 5: Rep
      Submit payment link in Mini App: 5: Rep, System
      Receive approval notification: 5: Rep, System
```
] <fig-sales-rep-journey>

When a representative meets a client, they open the Mini App and enter the company's 10-digit TIN. The cache confirms availability in under 100 milliseconds. The representative enters the company details and primary contact, saving the account to Notion, and schedules a follow-up call. When the client transfers their deposit, the representative copies the confirmation link from the bank's message and submits it through the app. Once management reviews the payment, the representative receives a notification that the deal is approved.

== Front Desk Receptionist Journey

The receptionist workflow ensures walk-in visitors are processed quickly and assigned fairly:

#figure(
  caption: [Front Desk Receptionist Walk-In Processing Journey],
)[
```mermaid
journey
    title Front Desk Receptionist Walk-In Processing
    section Visitor Arrival
      Greet visitor in lobby: 5: Receptionist
      Collect business card and 10-digit TIN: 4: Receptionist
    section Digital Intake
      Open Reception Console in Mini App: 5: Receptionist
      Enter company name and TIN: 4: Receptionist
      Check if account already exists: 5: Receptionist, System
    section Lead Assignment
      Submit for round-robin assignment: 5: Receptionist, System
      System selects rep with oldest turn: 5: System
      Push alert sent to rep's phone: 5: System, Rep
      Direct visitor to meeting room: 5: Receptionist, Client
```
] <fig-receptionist-journey>

When a visitor arrives, the receptionist opens the reception console and enters the visitor's 10-digit TIN. If the company is already registered, the screen displays the assigned representative so the receptionist can contact them directly. If the account is new, the receptionist enters the visitor's details and clicks assign. The queue engine selects the representative whose turn is oldest, updates their timestamp, and sends an alert to their phone. The receptionist directs the visitor to a meeting room, knowing the representative has been notified.

== Executive Leadership Journey

The executive workflow provides continuous visibility into pipeline activity through Notion:

#figure(
  caption: [Executive Leadership Pipeline Governance Journey],
)[
```mermaid
journey
    title Executive Leadership Pipeline Governance
    section Daily Review
      Open Notion on desktop or tablet: 5: Manager
      Review deals across Kanban board: 5: Manager
    section Payment Approval
      Receive Telegram alert with bank link: 5: Manager, System
      Tap link to view bank receipt page: 5: Manager
      Confirm deposit matches agreed amount: 5: Manager
      Move deal to Won in Notion: 5: Manager
    section Pipeline Maintenance
      Receive 7-day inactivity alert: 4: Manager, System
      Follow up or reassign stalled deal: 4: Manager
```
] <fig-executive-journey>

Managers check the pipeline board in Notion, where active deals are organized by stage with live totals. When a payment link is submitted, the manager receives a Telegram message with a direct link to the bank's hosted receipt page. The manager taps the link, confirms that the funds match the agreed amount, and moves the deal to `Won` in Notion. If a deal remains inactive for seven days, an automated alert flags the account so management can step in.

= Architectural Extensibility

== Storage Adapter Architecture

File uploads use an adapter pattern to avoid cloud vendor lock-in:

```typescript
export interface StorageProvider {
  uploadFile(buffer: Buffer, filename: string, mimeType: string): Promise<string>;
  getPublicUrl(filePath: string): string;
}
```

The codebase includes three drivers:
- *Supabase Storage Driver:* The default implementation for initial deployment, providing object storage without separate cloud infrastructure setup.
- *AWS S3 / Cloudflare R2 Driver:* A production driver that allows switching to dedicated AWS S3 or Cloudflare R2 buckets by updating environment variables, with no code changes required.
- *Mock Storage Driver:* An in-memory driver used for automated testing and offline development.

== Banking API Roadmap

The current architecture uses bank confirmation share links to match the capabilities of Ethiopian financial institutions today. The service layer is structured to support direct bank API integrations and webhooks in the future:

#figure(
  caption: [Banking Integration Architecture: Current Share-Link Workflow vs. Future Direct API],
)[
```mermaid
graph LR
    subgraph Phase1Current ["Phase 1: Current Architecture"]
        REP1["Sales Rep"] -->|"Pastes Bank Share Link"| API1["Backend Deals Service"]
        API1 -->|"Sends Push Alert"| MGR1["Manager Review"]
    end

    subgraph Phase2Future ["Phase 2: Direct Bank API Integration"]
        REP2["Sales Rep"] -->|"Enters Transaction Ref"| API2["Backend Payments Adapter"]
        API2 -->|"Queries Bank API"| BANK_API["Bank Gateway (Telebirr / CBE / EthSwitch)"]
        BANK_API -->|"Status: Settled"| API2
        API2 -->|"Auto-Advances to Won"| NOTION["Notion Deals DB"]
    end
```
] <fig-banking-roadmap>

- *Reference ID Ingestion:* Transitioning from full URLs to raw transaction reference numbers (such as CBE Financial Transaction numbers or Telebirr IDs) verified against a banking integration interface.
- *Direct Bank Verification:* Connecting the verification interface directly to commercial bank APIs or national payment switches. When the bank confirms settlement, the platform will automatically update the deal to `Won` without requiring manual review.

= Implementation Schedule, Pricing, & SLA

== Implementation Schedule

The platform deployment is divided into four sequential phases:

#figure(
  caption: [Four-Phase Turnkey Implementation Schedule],
)[
```mermaid
gantt
    title Implementation Schedule
    dateFormat  YYYY-MM-DD
    section Phase 1: Provisioning
    Notion Workspace & Schema Setup         :p1_1, 2026-11-02, 3d
    Telegram Bot Registration & Config      :p1_2, after p1_1, 2d
    section Phase 2: Deployment
    Backend Infrastructure Deployment       :p2_1, after p1_2, 3d
    Frontend Static Build & Domain Setup    :p2_2, after p2_1, 2d
    section Phase 3: Testing & Roster
    Staff Roster Registration & Approvals   :p3_1, after p2_2, 2d
    End-to-End Workflow Testing             :p3_2, after p3_1, 3d
    section Phase 4: Launch
    Staff Training Walkthroughs             :p4_1, after p3_2, 2d
    Production Go-Live & Chat Deprecation   :p4_2, after p4_1, 1d
```
] <fig-implementation-schedule>

- *Phase 1: Environment Setup (Days 1--5):* Provision corporate Telegram Bot tokens, configure Notion integration keys, run automated database creation scripts, and verify relationships between the six CRM databases.
- *Phase 2: Application Deployment (Days 6--10):* Deploy the Express backend web service, build and publish the React Mini App, configure HTTPS domains, and set the persistent menu button in Telegram.
- *Phase 3: User Setup & Testing (Days 11--15):* Register the initial team roster (6 Sales Representatives, 1 Receptionist, 3 Managers), verify HMAC authentication, and test queue assignments and payment link submissions.
- *Phase 4: Training & Go-Live (Days 16--18):* Distribute the User Operations Field Manual, conduct practical walkthroughs with sales staff and reception, and transition team communication off the informal group chat.

== Commercial Pricing Framework

#table(
  columns: (1.5fr, 2.5fr, 1.8fr, 2fr),
  stroke: 0.5pt + rgb("cbd5e1"),
  fill: (col, row) => if row == 0 { rgb("f1f5f9") } else { none },
  align: (col, row) => if row == 0 { center + horizon } else { left + horizon },
  [*Item*], [*Scope & Deliverables*], [*Fee Structure*], [*Status / Terms*],
  [Turnkey Implementation], [Database setup, backend deployment, bot configuration, frontend publishing, and staff onboarding], [Fixed Project Fee], [TBD: Implementation Fee (USD / ETB Amount)],
  [Platform Licensing], [Complete proprietary source code, intellectual property transfer, and repository access], [Perpetual License], [Included in Project Fee / Perpetual],
  [Hosting (Cloud)], [Web service execution, CDN distribution, and object storage], [Pass-Through Operating Expense], [Estimated \$15 -- \$35 / Month],
  [Annual Support & Maintenance], [Bug fixes, platform updates, Notion API maintenance, and 99.9% uptime target], [Annual Agreement], [TBD: Annual Maintenance Fee],
)

*Payment Schedule:*
- *Milestone 1 (40%):* Project start and environment setup.
- *Milestone 2 (40%):* Deployment, testing, and staff roster onboarding.
- *Milestone 3 (20%):* Go-live, staff training, and final acceptance.

== Service Level Agreement

- *Uptime Target:* 99.9% monthly uptime for API routing and Mini App delivery, excluding scheduled maintenance announced 48 hours in advance.
- *Severity 1 (Critical Outage):* Core API unreachable or TIN lookup engine unavailable. Response within 60 minutes; resolution target within 4 hours.
- *Severity 2 (Degraded Performance):* Non-critical notifications delayed or report synchronization lag. Response within 4 hours; resolution target within 1 business day.
- *Severity 3 (General Support):* User roster adjustments or configuration questions. Response within 1 business day.

== Executive Sign-Off

#v(8pt)
#table(
  columns: (1.5fr, 1.5fr, 1.5fr, 1.8fr, 1fr),
  stroke: 0.5pt + rgb("cbd5e1"),
  fill: (col, row) => if row == 0 { rgb("f1f5f9") } else { none },
  align: (col, row) => if row == 0 { center + horizon } else { left + horizon },
  [*Role*], [*Name*], [*Title*], [*Signature*], [*Date*],
  [Client Executive Sponsor], [(Sponsor Name)], [Managing Director / CEO], [#line(length: 100%, stroke: 0.5pt + rgb("94a3b8"))], [(Date)],
  [Client Commercial Lead], [(Commercial Lead Name)], [Head of Sales], [#line(length: 100%, stroke: 0.5pt + rgb("94a3b8"))], [(Date)],
  [Client Technical Lead], [(IT Lead Name)], [Head of IT], [#line(length: 100%, stroke: 0.5pt + rgb("94a3b8"))], [(Date)],
  [Solutions Architect], [(Architect Name)], [Principal Solutions Architect], [#line(length: 100%, stroke: 0.5pt + rgb("94a3b8"))], [(Date)],
)
