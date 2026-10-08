## Telegram Web App & Notion CRM Integration

## DETAILED TECHNICAL ARCHITECTURE & EXECUTION PLAN

TARGET AUDIENCE

Sales Team & Execs

API

CORE TECH

DATABASE

CLIENT INTERFACE

Node.js / Python + Notion

Notion Relational

Telegram Mini App (TWA)

Workspace

## 1. System Architecture Overview

This project introduces a synchronized ecosystem linking field sales operations, walk-in front-desk management, and management oversight. The front-end operates as a lightweight, low-friction Telegram Web App (TWA) embedded directly within Telegram. The back-end service processes business logic, enforces duplicate prevention, and maintains real-time bi-directional synchronization with Notion, which functions as the executive CRM and data warehouse.

## 2. User Roles & Access Matrix

| Primary Role Key System Responsibilities Access Control Interface Pipeline oversight, performance Notion Managers (3) tracking, conflict resolution, global Full Workspace Admin Access Workspace sales analytics. TIN verification, lead registration, Telegram Mini Restricted to self-assigned |
| --- |
| Sales Reps (6) follow-up logging, deposit proof App records via Bot upload. Register walk-in customers, trigger Telegram Web Specialized Receptionist Front Desk (1) rotational queue assignment to active |
| App Interface reps. |


## 3. Notion Database Schema & Architecture

To enable drill-down reports for managers, the Notion workspace is structured into six linked databases. This normalized architecture ensures data integrity and high-performance querying via the Notion API.

| Database Name | Key Fields / Properties | Relations & Formulae |
| --- | --- | --- |
|   | Telegram ID (Unique ID), Full Name, Phone, Status | Relation to Accounts, Deals, and |
| Sales Reps | (Active/Inactive), Total Sales Count | Sales Logs. |
|   | Company Name, TIN Number (Unique Index), Address, | Relation to Sales Reps (Owner), |
| Accounts (Customers) | Industry, Assigned Date | Contacts, and Deals. |
|   | Deal Title, Stage (New, Contacted, Proposal, Won, Lost), | Relation to Accounts, Sales Reps, |
| Deals / Pipeline |   |   |
|   | Amount, Deposit Ref # | and Payment Proofs. |
|   | Contact Name, Phone, Email, Position, Primary Contact |   |
| Contacts |   | Relation to Accounts. |
|   | Flag |   |
|   | Interaction Type (Call, Meeting, Note), Activity Date, |   |
| Sales Logs |   | Relation to Deals and Sales Reps. |
|   | Note Content, Location |   |
|   | Rep ID, Order Position, Availability Status, Last | Used by Front Desk algorithm for |
| Rotational Queue | Assigned Timestamp | walk-in routing. |

## 4. Core Technical Workflows

## Workflow A: Sales Rep Onboarding

- 1. Rep launches Telegram Bot using /start.

- 2. Bot queries Notion Sales Reps DB via Telegram User ID.

- 3. If ID is missing, Bot initiates setup form (Name, Phone, Role).

- 4. Backend creates record in Sales Reps DB and sets status to "Pending Approval".

- 5. Manager receives alert in Notion/Telegram to approve access.

## Workflow B: TIN Conflict Verification

- 1. Rep initiates "New Lead" in Telegram Web App.

- 2. App prompts for Tax Identification Number (TIN).

- 3. Backend queries Notion Accounts DB matching TIN.

- 4. Match Found: Returns owner name and blocks registration.

- 5. No Match: Unlocks registration form and reserves TIN.

Conflict Prevention Protocol: If a sales rep enters an existing TIN, the system immediately returns: "Company registered under [Sales Rep Name] on [Date]. Duplicate registration blocked. Please contact [Sales Rep Name] for internal transfers."


## 5. Specialized Workflows

## Front Desk Walk-In Assignment

Automated round-robin assignment system for incoming leads.

- Receptionist inputs Walk-in Company Details and TIN into Front Desk Web App view.

- System checks TIN for existing owner. If clear, queries Rotational Queue DB for next available rep.

- Assigns lead to designated rep, logs transaction, and advances rep queue position.

- Instant push notification sent to Rep’s Telegram: "New Walk-In assigned!"

## Purchase & Payment Proof Logging

Post-sale verification and accounting handover.

- Sales Rep selects deal in Mini App and clicks "Log Purchase".

- Rep inputs Deposit Reference Number and attaches receipt/bank transfer image.

- Image is uploaded to cloud storage (S3) and attached to Notion Deals DB.

- Stage updates to "Payment Pending Verification" and alerts Manager.

## 6. Manager Workspace & Navigation Architecture

Notion serves as the executive cockpit. The workspace is built around dynamic relational views, allowing managers to seamlessly inspect rep activities without switching contexts.

| Dashboard View | Layout Components | Executive Purpose |
| --- | --- | --- |
|   | Gallery View with Rollup properties showing | 1-Click drill-down into an individual |
| Sales Rep Directory | active deal count, monthly revenue, last | sales rep’s full activity log and |
|   | activity timestamp. | accounts. |
|   | Kanban Board grouped by Stage, filtered by | Visual tracking of company-wide sales |
| Master Pipeline Board |   |   |
|   | Rep, Date, or Deal Value. | progress and stage velocity. |
|   | Table View showing failed TIN attempts, | Ensures organizational policy |
| Audit & Conflict Log |   |   |
|   | reassignments, and deposit approvals. | compliance and resolves disputes. |

## 7. Automated Notification Engine

A background worker (Cron / Node-Cron) periodically queries Notion databases to trigger automated Telegram notifications to keep sales reps engaged and proactive.

- Follow-Up Alerts: Daily 9:00 AM push notification detailing leads scheduled for follow-up today.

- Inactivity Warning: Triggers if an active deal has no logged activity in 7 days.

- Stage Movement Updates: Manager alerts when a deal transitions to "Payment Proof Submitted".


## 8. Implementation & Deployment Roadmap

| Phase Milestones | Deliverables | Timeline |
| --- | --- | --- |
| Notion Database | Setup databases, relations, rollups, formula |   |
| Phase 1 |   | Week 1 |
| Architecture | fields, and access permissions. |   |
|   | Node.js/Python server, Notion API service |   |
| Backend & API Integration Phase 2 |   | Weeks 2–3 |
|   | layer, Telegram Bot authentication. |   |
|   | Frontend interface for TIN lookup, lead |   |
| Telegram Mini App (TWA) Phase 3 | creation, follow-ups, and image uploads. | Weeks 3–4 |
| Rotational Queue & | Front Desk interface, round-robin algorithm, |   |
| Phase 4 Triggers | automated reminder notifications. | Week 5 |
| Testing & Deployment | UAT with 6 reps + 1 receptionist, | Week 6 |
| Phase 5 |   |   |
|   | performance optimization, user training. |   |

## 9. Security, Authentication & Data Integrity

Since Telegram handles client access, security relies on Telegram WebApp initData cryptographic verification. Every HTTP request made from the WebApp passes a signature derived from the Bot Token, ensuring users cannot forge another sales rep's Telegram ID.

Critical Security Enforcement: All write operations (creating leads, modifying deals) require token validation at the backend server. The backend directly checks Notion permissions prior to performing any mutating database queries.

## 10. Next Steps for Execution

- 1. Notion Workspace Preparation: Create an integration token under notion.so/my-integrations and grant access to the root CRM page.

- 2. Bot Father Provisioning: Register the Telegram Bot via @BotFather and configure the Mini App domain endpoint.

- 3. Environment Setup: Provision backend hosting (e.g., Render, Railway, or AWS) with Node.js / Python environment.
