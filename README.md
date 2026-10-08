# Telegram Sales Mini App & Notion CRM

A production-ready Telegram Mini App (TWA) and Telegram Bot integrated with Notion as a relational CRM datastore. Engineered for Ethiopian business operations with real-time lead ownership conflict checks (10-digit TIN), automated round-robin lead distribution, bank payment link tracking, and manager executive dashboards.

---

## Architecture Overview

```
                      ┌──────────────────────────────────────┐
                      │    Telegram Client (Mobile / PC)     │
                      └──────────────────┬───────────────────┘
                                         │
                 ┌───────────────────────┴───────────────────────┐
                 │                                               │
                 ▼                                               ▼
     ┌───────────────────────┐                       ┌───────────────────────┐
     │ Telegram Bot (GrammY) │                       │  Telegram Mini App    │
     │  - Lead Dispatcher    │                       │  (Vite + React + TS)  │
     │  - Manager Approvals  │                       │  - TIN Conflict Engine│
     │  - Daily Briefings    │                       │  - Walk-In Intake     │
     └───────────┬───────────┘                       │  - Payment Receipts   │
                 │                                   └───────────┬───────────┘
                 │                                               │
                 └───────────────────────┬───────────────────────┘
                                         ▼
                         ┌───────────────────────────────┐
                         │ Node.js Backend Service Layer │
                         │ (Express / TypeScript / Fastify)│
                         │ - HMAC-SHA256 InitData Auth   │
                         │ - Sub-100ms TIN Cache Engine  │
                         │ - Resilience & Retry Wrappers │
                         └───────────────┬───────────────┘
                                         ▼
                         ┌───────────────────────────────┐
                         │   Notion Relational CRM DBs   │
                         │   - Sales Reps                │
                         │   - Accounts (TIN unique)     │
                         │   - Deals & Pipeline          │
                         │   - Contacts                  │
                         │   - Sales Logs                │
                         │   - Round-Robin Pointer       │
                         └───────────────────────────────┘
```

---

## Project Structure

```
├── backend/
│   ├── src/
│   │   ├── modules/
│   │   │   ├── auth/          # Telegram HMAC-SHA256 initData validation
│   │   │   ├── bot/           # GrammY bot logic, commands, notifications
│   │   │   ├── cron/          # Automated daily 9 AM briefing & inactivity sweepers
│   │   │   ├── deals/         # Deals pipeline & bank payment link tracking
│   │   │   ├── leads/         # TIN conflict validation & round-robin assignment
│   │   │   ├── notion/        # Notion SDK client, backoff retries & DB queries
│   │   │   └── queue/         # Round-robin pointer queue persistence
│   │   ├── services/          # Storage abstraction (Cloudflare R2 / AWS S3 / Supabase)
│   │   ├── app.ts             # Express app setup
│   │   └── server.ts          # Server entry point
│   ├── scripts/               # DB provisioning & workflow simulation scripts
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/        # Apple-design UI views (TIN Lookup, Deals, Walk-In)
│   │   ├── lib/               # Telegram WebApp SDK helpers & API client
│   │   └── index.css          # Apple Light Design System & Tailwind styles
│   ├── index.html
│   └── package.json
├── docs/                      # Architectural specs & payment proof documentation
├── .env.example               # Environment variables template
├── .gitignore
└── package.json
```

---

## Local Development

### 1. Install Dependencies
```bash
# Root
npm install

# Backend
cd backend && npm install

# Frontend
cd ../frontend && npm install
```

### 2. Environment Configuration
Copy `.env.example` to `.env` and fill in your credentials:
```bash
cp .env.example .env
```

### 3. Run Development Servers
```bash
# Backend (port 3000)
npm run dev:backend

# Frontend (port 5173)
npm run dev:frontend
```

### 4. Run Test Suite
```bash
npm test
```

---

## Render Deployment Guide

### Option A: Static Site (Frontend) + Web Service (Backend)

1. **Backend Web Service**:
   - **Environment**: Node
   - **Root Directory**: `backend`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Environment Variables**: Add all variables specified in `.env.example`

2. **Frontend Static Site**:
   - **Root Directory**: `frontend`
   - **Build Command**: `npm install && npm run build`
   - **Publish Directory**: `dist`
   - **Environment Variables**:
     - `VITE_API_URL`: URL of the deployed backend Web Service (e.g. `https://your-backend.onrender.com`)

3. **Telegram Bot Setup**:
   Once deployed, run:
   ```bash
   npx tsx scripts/setup-telegram-bot.ts
   ```
   with your production frontend URL as `WEBAPP_URL`.
