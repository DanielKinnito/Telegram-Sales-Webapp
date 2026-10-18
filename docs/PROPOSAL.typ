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
    subgraph CurrentState ["Status Quo: Manual Group Chat Verification"]
        A1["Rep meets prospect<br/>on client site"] --> B1["Posts company name<br/>in group chat"]
        B1 --> C1["Waits 1 to 4 hours<br/>for team replies"]
        C1 --> D1{"Does everyone<br/>reply in time?"}
        D1 -- "No" --> E1["Account Collision &<br/>Commission Dispute"]
        D1 -- "Yes" --> F1["Delayed Outreach &<br/>Lost Deal Momentum"]
    end

    subgraph ProposedState ["Platform: Automated Instant Verification"]
        A2["Rep meets prospect<br/>on client site"] --> B2["Enters 10-digit TIN<br/>(Mini App or /checktin)"]
        B2 --> C2["In-Memory Cache Check<br/>(< 100ms response)"]
        C2 --> D2{"TIN already<br/>registered?"}
        D2 -- "Yes" --> E2["Registration Blocked<br/>(Conflict Prevented)"]
        D2 -- "No" --> F2["Instant Ownership &<br/>Deal Created in Notion"]
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
  [Lead Conflict Resolution], [30 mins to 4 hours waiting for chat replies], [Under 100ms via Mini App & /checktin command], [Eliminates account collisions and protects rep confidentiality],
  [Walk-In Lead Assignment], [15 to 45 mins of calls and lobby waiting], [Under 3 seconds via automated round-robin], [Impartial distribution; zero lobby wait time for visiting prospects],
  [Payment Verification], [24 to 72 hours matching slips to statements], [Instant push alert with direct bank link], [Same-day audit; orders released within minutes],
  [Pipeline & Executive Reporting], [4 to 8 hours weekly compiling spreadsheets], [Automated Friday 17:00 Notion report & /weekly_report], [Real-time executive visibility with zero manual reporting overhead],
  [Field Data Safety], [Accidental app closure loses half-typed forms], [Continuous LocalStorage draft save & exit protection], [Zero lost lead data on mobile devices during client visits],
  [Daily Sales Routine], [Irregular, informal morning check-ins], [Automated 09:00 AM EAT Telegram briefings & call alerts], [Daily follow-ups and due calls delivered punctually to reps],
  [Stalled Deal Intervention], [End-of-month manual reviews], [Automated 7-day inactivity alerts to managers], [Earlier management intervention on at-risk deals],
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
    subgraph ClientTier ["1. Client Interface Layer"]
        TMA["Telegram Mini App (React 19 + Vite 8)<br/>• Mobile UI & TWA SDK<br/>• LocalStorage Draft Auto-Save"]
        TG_BOT["Telegram Bot (GrammY Engine)<br/>• Onboarding & Direct /checktin<br/>• Scoped /weekly_report & Alerts"]
    end

    subgraph SecurityGateway ["2. Security Gateway"]
        HMAC_GUARD["HMAC-SHA256 Auth Guard<br/>• Cryptographic Hash Validation<br/>• 24h Expiration Enforcement"]
    end

    subgraph ServiceLayer ["3. Backend Application Tier (Node.js & Express 5)"]
        AUTH_SVC["Auth & Dynamic Manager Discovery"]
        LEADS_SVC["Leads & TIN Validation Service"]
        QUEUE_SVC["Rotational Queue Service"]
        DEALS_SVC["Deals & Payment Service"]
        REPORTS_SVC["Automated Notion Reports Engine"]
        CRON_SVC["Addis Ababa (EAT) Cron Workers"]
        TIN_CACHE[("In-Memory TIN Cache<br/>Sub-100ms Lookups")]
        STORAGE_ADP["Modular Cloud Storage Adapter"]
    end

    subgraph DatastoreTier ["4. CRM Datastore Layer (Notion API v5)"]
        RESILIENT_CLIENT["Resilient Notion Client Wrapper<br/>3 req/sec Rate Limiter & Backoff"]
        DB_REPS[("Sales Reps DB<br/>(Full Names & Roles)")]
        DB_ACCOUNTS[("Accounts DB<br/>(10-Digit TIN Unique)")]
        DB_DEALS[("Deals & Pipeline DB<br/>(Payment Proof URLs)")]
        DB_QUEUE[("Rotational Queue DB<br/>(Availability & Timestamp)")]
        DB_LOGS[("Sales Logs DB<br/>(12h EAT Timestamps)")]
        DB_REPORTS[("Executive Reports DB<br/>(Weekly Sales Summaries)")]
    end

    subgraph HostingTier ["5. 24/7 Production Cloud Infrastructure"]
        RENDER_SVC["Render Cloud Web Service<br/>Continuous Healthcheck (/health)"]
        CF_TUNNEL["Cloudflare Zero-Trust Tunnel<br/>Webhook Ingress Routing"]
    end

    TMA -->|"HMAC Header"| HMAC_GUARD
    HMAC_GUARD --> AUTH_SVC
    HMAC_GUARD --> LEADS_SVC
    HMAC_GUARD --> QUEUE_SVC
    HMAC_GUARD --> DEALS_SVC

    TG_BOT <-->|"Bot Events"| ServiceLayer

    LEADS_SVC <--> TIN_CACHE
    LEADS_SVC --> RESILIENT_CLIENT
    QUEUE_SVC --> RESILIENT_CLIENT
    DEALS_SVC --> RESILIENT_CLIENT
    REPORTS_SVC --> RESILIENT_CLIENT
    CRON_SVC --> RESILIENT_CLIENT
    DEALS_SVC -.-> STORAGE_ADP

    RESILIENT_CLIENT --> DB_REPS
    RESILIENT_CLIENT --> DB_ACCOUNTS
    RESILIENT_CLIENT --> DB_DEALS
    RESILIENT_CLIENT --> DB_QUEUE
    RESILIENT_CLIENT --> DB_LOGS
    RESILIENT_CLIENT --> DB_REPORTS

    QUEUE_SVC -->|"Push Alert"| TG_BOT
    DEALS_SVC -->|"Audit Alert"| TG_BOT
    CRON_SVC -->|"Daily Briefing"| TG_BOT
    REPORTS_SVC -->|"Report Alert"| TG_BOT

    RENDER_SVC --- ServiceLayer
    CF_TUNNEL --- RENDER_SVC
```
] <fig-system-architecture>

== Technology Stack

- *Frontend Client:* Built with React 19, TypeScript, and Vite 8. The UI uses standard mobile design conventions with Tailwind CSS v4, supporting touch gestures, clear card layouts, and responsive navigation. Telegram integration is handled by `@telegram-apps/sdk-react` v3.3.9. Form state is protected by continuous `localStorage` draft auto-save and native Telegram exit protection confirmation.
- *Backend Application:* Runs on Node.js using Express 5. Telegram bot commands, conversational onboarding, and notification alerts use GrammY (`grammy` v1.46.0). Features direct bot commands including `/checktin` (with privacy masking for reps) and `/weekly_report` (restricted exclusively to managers via `BotCommandScopeChat`). Automated background jobs use `node-cron` scheduled in East Africa Time (`Africa/Addis_Ababa`, UTC+3).
- *CRM Datastore:* Hosted in Notion via `@notionhq/client` v5.27.0. A custom client wrapper enforces a strict limit of 3 requests per second to comply with Notion API limits, with exponential backoff retries for transient errors. Instant duplicate TIN lookups are handled by an in-memory cache loaded at server startup. Active managers are discovered dynamically from the Notion roster with cached fallback. All relations display human-readable representative names, and consultation logs use 12-hour AM/PM formatting.
- *Reporting Engine:* Automated weekly executive report generator that compiles deals won, closed revenue (ETB), active pipeline stages, and representative performance into a dedicated Notion page every Friday at 17:00 EAT or on demand via `/weekly_report`, formatted for PDF export.
- *Production Hosting & Deployment:* Deployed 24/7 on Render cloud web services (`render.yaml`) with native automated health monitoring (`/health`). Webhook routing and development tunneling use Cloudflare zero-trust tunnels.
- *File Storage:* Storage uses an adapter interface configured for Supabase Storage (`@supabase/supabase-js` v2.117.3), with drop-in support for AWS S3 and Cloudflare R2.

= Operational Workflows

== Staff Onboarding, Dynamic Role Discovery, and Access Control

Access is strictly governed by role-based permissions synchronized with Notion. When a new team member opens the company Telegram bot and sends `/start`, the system checks the `Sales Reps DB`. If the user is unlisted, the bot prompts for their full legal name, phone number, and desired operational role (`Sales Rep`, `Receptionist`, or `Manager`).

The system initializes a pending record in Notion and immediately dispatches an alert with inline `[Approve]` and `[Reject]` action buttons to executive managers on Telegram. To prevent configuration lag, the platform features *Dynamic Notion-Driven Manager Discovery*: active managers are retrieved directly from the Notion roster with in-memory TTL caching and fallback, meaning promotions, reassignments, or roster adjustments made in Notion apply instantly across Telegram notification channels without server restarts.

Every API request from the Mini App is validated using HMAC-SHA256 signature verification against the bot token. Sessions exceeding 24 hours are rejected. User identity is extracted exclusively from the cryptographically verified signature.

#figure(
  caption: [Staff Onboarding and Cryptographic HMAC Authentication Flow],
)[
```mermaid
sequenceDiagram
    autonumber
    actor Staff as New Team Member
    participant Bot as Corporate Telegram Bot
    participant Backend as Gateway & Manager Discovery
    participant Notion as Notion (Sales Reps DB)
    actor Mgr as Executive Manager
    actor Rep as Active Representative
    participant TMA as Telegram Mini App

    Staff->>Bot: Sends /start
    Bot->>Notion: Checks Telegram ID in Reps DB
    Notion-->>Bot: No active record
    Bot-->>Staff: Prompts for Name, Phone, Role
    Staff->>Bot: Submits profile information
    Bot->>Notion: Creates record (Status = Pending)
    Notion-->>Bot: Confirmation
    Bot->>Mgr: Sends alert with [Approve] / [Reject]
    Mgr->>Bot: Clicks [Approve]
    Bot->>Notion: Updates record (Status = Active)
    Bot-->>Staff: Sends approval confirmation

    Note over Rep,TMA: Daily Authenticated Access
    Rep->>TMA: Launches Mini App
    TMA->>Backend: GET /api/auth/me (HMAC Header)
    Backend->>Backend: Validates HMAC-SHA256 & Expiry
    Backend->>Notion: Verifies Role & Active Status
    Notion-->>Backend: Confirms active profile
    Backend-->>TMA: Returns authorized profile
    TMA-->>Rep: Renders role-specific workspace
```
] <fig-staff-onboarding>

== Dual-Channel TIN Deduplication, Privacy Filtering, & Draft Auto-Save

The platform enforces conflict prevention using the mandatory 10-digit Ethiopian Taxpayer Identification Number (TIN) across two integrated channels:

1. *Direct Telegram Bot Command (`/checktin <tin>`):* Representatives and managers can verify account status directly within Telegram chat without opening the web interface:
   - *Representative Scope:* If the TIN is taken, the bot responds that the company is already registered while *hiding the owner's name*. This preserves rep privacy, prevents internal customer poaching, and avoids disputes.
   - *Manager Scope:* When executive managers run `/checktin`, the bot displays full ownership intelligence (assigned representative, company name, registration date), allowing swift management arbitration.
2. *Mini App TIN Engine & Local Draft Protection:* Within the Mini App, TIN inputs are verified in under 100 milliseconds against the in-memory cache. To safeguard field data on mobile devices, the client features *Continuous LocalStorage Draft Auto-Save* and *Telegram Native Exit Protection*:
   - All form keystrokes are saved locally in real time.
   - If a representative accidentally gestures to close Telegram, a native confirmation modal intercepts the exit.
   - If the app restarts, a prominent "Restore Draft" banner restores all customer notes with a single tap.

#figure(
  caption: [Dual-Channel TIN Deduplication and Account Registration Sequence],
)[
```mermaid
sequenceDiagram
    autonumber
    actor Rep as Sales Representative
    participant Bot as Telegram Bot (/checktin)
    participant TMA as Mini App & Draft Engine
    participant API as Backend Leads Router
    participant Cache as In-Memory TIN Cache
    participant Notion as Notion Accounts DB
    actor Mgr as Executive Manager

    Note over Rep,Bot: Channel A: Instant Chat Check
    Rep->>Bot: Sends /checktin 0012345678
    Bot->>Cache: Checks TIN in cache
    alt TIN Registered (Rep View)
        Bot-->>Rep: "Already Registered (Owner Hidden)"
    else TIN Registered (Manager View)
        Mgr->>Bot: Sends /checktin 0012345678
        Bot-->>Mgr: "Registered to [Rep Name] on [Date]"
    end

    Note over Rep,TMA: Channel B: Mini App Lead Registration
    Rep->>TMA: Inputs 10-digit TIN in Mini App
    TMA->>API: GET /api/leads/check-tin
    API->>Cache: Checks in-memory cache
    alt Clean / Unassigned TIN
        API-->>TMA: Confirms TIN Available
        TMA-->>Rep: Displays green check & unlocks form
        Rep->>TMA: Types company & contact details
        TMA->>TMA: Auto-saves draft to LocalStorage
        Rep->>TMA: Taps 'Register Lead'
        TMA->>API: POST /api/leads
        API->>Notion: Creates Account in Notion
        API->>Cache: Reserves TIN in memory
        API-->>TMA: Success confirmation
        TMA->>TMA: Clears saved draft
        TMA-->>Rep: Opens deal card
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

== Automated Notifications, Precision Reminders, & Executive Reporting

The platform includes background scheduled workers running in East Africa Time (UTC+3) alongside on-demand manager triggers to ensure systematic operational momentum:

- *Daily Follow-Up Briefing (09:00 AM EAT):* Scans the `Sales Logs DB` for all interactions scheduled for the current business day. Activities are organized per representative, and a structured morning agenda is delivered directly to their Telegram chat.
- *Inactivity Sweeper (10:00 AM EAT):* Audits active pipeline deals. Opportunities without logged activity for seven or more calendar days trigger an executive escalation to managers detailing the deal name, contract value, assigned representative, and days idle.
- *Precision Call Reminders (Every 60 Seconds):* Evaluates scheduled consultation commitments every minute. At the designated minute, the representative receives an immediate mobile alert with the customer's contact details, phone number, and consultation goals.
- *Automated Weekly Sales Report (Fridays at 17:00 EAT) & On-Demand `/weekly_report`:* Every Friday at the close of business, the system automatically aggregates closed revenue (ETB), won deals, pipeline stage conversions, and individual rep metrics, compiling an executive report page directly into the Notion CRM. In addition, executive managers can invoke `/weekly_report` at any time from Telegram to compile an immediate real-time report.

#figure(
  caption: [Automated Scheduled Notifications and Inactivity Alert Architecture],
)[
```mermaid
sequenceDiagram
    autonumber
    participant Cron as EAT Scheduler (node-cron)
    participant Service as Cron & Reports Engine
    participant Notion as Notion CRM Datastores
    participant Bot as Corporate Telegram Bot
    actor Rep as Sales Representative
    actor Mgr as Executive Manager

    Note over Cron: 09:00 AM EAT: Daily Briefing
    Cron->>Service: Triggers morning briefing
    Service->>Notion: Queries today's scheduled activities
    Notion-->>Service: Returns activities per rep
    Service->>Bot: Dispatches morning agenda
    Bot->>Rep: Delivers daily schedule

    Note over Cron: 10:00 AM EAT: Inactivity Sweeper
    Cron->>Service: Triggers pipeline audit
    Service->>Notion: Checks deals inactive >= 7 days
    Notion-->>Service: Returns stalled deals
    Service->>Bot: Dispatches management escalation
    Bot->>Mgr: Delivers stalled deal alert

    Note over Cron,Service: Friday 17:00 EAT / On-Demand (/weekly_report)
    alt Automated Friday Schedule
        Cron->>Service: Triggers Friday 17:00 weekly report
    else Manager On-Demand Command
        Mgr->>Bot: Sends /weekly_report
        Bot->>Service: Executes ReportsService.generateReport()
    end
    Service->>Notion: Aggregates deals, revenue, & rep performance
    Service->>Notion: Creates formatted Executive Report page
    Service->>Bot: Sends summary alert with direct report URL
    Bot->>Mgr: Delivers weekly revenue & pipeline metrics
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

== Commercial Investment & Payment Agreement Form

This commercial framework governs the turnkey delivery, licensing, and aftersales maintenance of the B2B Sales Operations Platform.

=== Investment Summary

#table(
  columns: (1.5fr, 2.5fr, 1.5fr, 2fr),
  stroke: 0.5pt + rgb("cbd5e1"),
  fill: (col, row) => if row == 0 { rgb("f1f5f9") } else { none },
  align: (col, row) => if row == 0 { center + horizon } else { left + horizon },
  [*Item*], [*Scope & Deliverables*], [*Investment*], [*Payment Structure*],
  [Turnkey System Implementation], [Complete software delivery, Telegram Bot configuration, React Mini App build, Notion CRM setup, Render 24/7 deployment, and staff training], [*ETB 200,000*], [Milestone-Based (Upfront, Delivery, 6-Month Retention)],
  [Platform Licensing], [Proprietary source code transfer, repository access, and unrestricted perpetual corporate usage], [*Included*], [Perpetual License (Included in System Fee)],
  [Annual Aftersales Maintenance], [2-month interval proactive maintenance, Notion API adaptation, uptime monitoring, bug resolution, and SLA support], [*ETB 100,000 / year*], [Annual Agreement (Scheduled Bi-Monthly Reviews)],
  [*Total First-Year Value*], [*Comprehensive Turnkey System + 1 Full Year of Aftersales Maintenance*], [*ETB 300,000*], [*Total Year 1 Commitment*],
)

_Note: Infrastructure cloud hosting (Render web services and Cloudflare tunnels) operates as a pass-through operating expense estimated between \$15 and \$35 USD per month._

=== System Implementation Payment Milestones (ETB 200,000)

Payments for the system are staged across three verified delivery milestones:

- *Milestone 1 --- Upfront Project Kickoff Deposit (ETB 50,000 / 25%):*
  Payable immediately upon contract execution.
  _Deliverables:_ Environment setup, corporate Telegram bot token provisioning, Notion workspace database creation, and security gateway configuration.
- *Milestone 2 --- System Delivery, Onboarding & Go-Live Acceptance (ETB 100,000 / 50%):*
  Payable upon formal go-live acceptance.
  _Deliverables:_ Production deployment on Render, Mini App publication, initial staff roster registration (6 Sales Reps, 1 Receptionist, 3 Managers), verified end-to-end workflow execution, and staff training completion.
- *Milestone 3 --- Production Warranty Retention (ETB 50,000 / 25%):*
  Payable after *six (6) months* of active production operation.
  _Deliverables:_ Continuous operational verification, resolution of any latent warranty defects, and verified data integrity across the Notion CRM datastores.

=== Aftersales Maintenance & Service Schedule (ETB 100,000 / Year)

Ongoing platform reliability is backed by a structured proactive maintenance plan:

- *2-Month Maintenance Intervals (Bi-Monthly Review Cycles):* A dedicated engineering inspection is conducted every two months to audit in-memory TIN cache efficiency, optimize Notion database relations, review API rate-limit headroom, verify Telegram webhook hygiene, and apply security patches.
- *Continuous Notion API Adaptation:* Ongoing updates to maintain compatibility with Notion API version enhancements and schema adjustments.
- *Priority Bug Resolution:* Dedicated engineering support for system anomalies, data reconciliation, or roster adjustments.

== Service Level Agreement

- *Uptime Target:* 99.9% monthly uptime for API routing and Mini App delivery, excluding scheduled maintenance announced 48 hours in advance.
- *Severity 1 (Critical Outage):* Core API unreachable or TIN lookup engine unavailable. Response within 60 minutes; resolution target within 4 hours.
- *Severity 2 (Degraded Performance):* Non-critical notifications delayed or report synchronization lag. Response within 4 hours; resolution target within 1 business day.
- *Severity 3 (General Support):* User roster adjustments or configuration questions. Response within 1 business day.

== Commercial Agreement & Executive Sign-Off

By signing below, the parties agree to the scope, milestones, fees, and service level commitments detailed in this Commercial & Technical Proposal.

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
