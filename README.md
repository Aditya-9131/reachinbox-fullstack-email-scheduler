# ReachInbox Production-Grade Full-Stack Email Job Scheduler

[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-blue.svg)](https://www.typescriptlang.org/)
[![Express.js](https://img.shields.io/badge/Express.js-4.19-lightgrey.svg)](https://expressjs.com/)
[![BullMQ](https://img.shields.io/badge/BullMQ-Redis-red.svg)](https://docs.bullmq.io/)
[![Elasticsearch](https://img.shields.io/badge/Elasticsearch-8.13-teal.svg)](https://www.elastic.co/)
[![React](https://img.shields.io/badge/React-18-61dafb.svg)](https://react.dev/)
[![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-3.4-38bdf8.svg)](https://tailwindcss.com/)

> **ReachInbox Hiring Assignment – Full-Stack Email Job Scheduler**
> Built with TypeScript, Express.js, BullMQ, Redis, Prisma (PostgreSQL / SQLite), Elasticsearch, Ethereal Fake SMTP, Slack OAuth / Webhooks, and a React/Vite dashboard matching the Figma specifications.

---

## 📑 Table of Contents

1. [Architectural Overview & Design](#-architectural-overview--design)
2. [Key Feature Breakdown](#-key-feature-breakdown)
3. [Zero-Cron Scheduling & Idempotency Guarantee](#-zero-cron-scheduling--idempotency-guarantee)
4. [Rate Limiting, Throttling & Auto-Rescheduling](#-rate-limiting-throttling--auto-rescheduling)
5. [Server Restart Resilience](#-server-restart-resilience)
6. [Slack OAuth & Rate Limit Alert Integration](#-slack-oauth--rate-limit-alert-integration)
7. [Elasticsearch Indexing & Search Engine](#-elasticsearch-indexing--search-engine)
8. [Live BullMQ Monitoring Dashboard](#-live-bullmq-monitoring-dashboard)
9. [Getting Started & Local Setup](#-getting-started--local-setup)
   - [Option A: Docker Compose (One-Click Turnkey)](#option-a-docker-compose-one-click-turnkey)
   - [Option B: Standalone Local Development](#option-b-standalone-local-development)
10. [Environment Variables Reference](#-environment-variables-reference)
11. [API Specification](#-api-specification)
12. [Step-by-Step Demo & Verification Script](#-step-by-step-demo--verification-script)
13. [Assumptions & Design Trade-offs](#-assumptions--design-trade-offs)

---

## 🏛 Architectural Overview & Design

The system implements an asynchronous event-driven architecture designed for high throughput, fault tolerance, and multi-tenant domain reputation protection.

```
                               ┌────────────────────────────────────────────────────────┐
                               │           React + Vite Frontend (Port 5173)            │
                               │  Google Auth • Compose Modal • CSV Leads • Elasticsearch  │
                               └──────────────────────────┬─────────────────────────────┘
                                                          │ HTTP / REST API
                                                          ▼
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                Express.js + TypeScript Backend (Port 5000)                             │
│                                                                                                        │
│  ┌─────────────────────────┐   ┌──────────────────────────┐   ┌─────────────────────────────────────┐  │
│  │ EmailSchedulerService   │   │  SlackNotificationService│   │    ElasticsearchQueryService        │  │
│  └───────────┬─────────────┘   └────────────▲─────────────┘   └──────────────────┬──────────────────┘  │
│              │                              │                                    │                     │
│              ▼                              │                                    ▼                     │
│  ┌─────────────────────────┐                │                        ┌───────────────────────┐         │
│  │ BullMQ Delayed Queue    │                │                        │ Elasticsearch Index   │         │
│  │ (email-queue in Redis)  │                │                        │ (reachinbox_emails)   │         │
│  └───────────┬─────────────┘                │                        └───────────────────────┘         │
│              │                              │                                                          │
│              ▼                              │                                                          │
│  ┌──────────────────────────────────────────┴─────────────────────────┐                                │
│  │ BullMQ Worker Pool (Configurable Concurrency = N)                  │                                │
│  │  1. Check Redis Sliding Window Rate Limit (e.g., 50/hour/sender)   │                                │
│  │  2. Exceeded? ──► Trigger Live Slack Alert + Reschedule to Next Hr │                                │
│  │  3. Allowed?  ──► Apply Throttle Delay (2s) + Dispatch via SMTP    │                                │
│  └──────────────────────────────────────────┬─────────────────────────┘                                │
└─────────────────────────────────────────────┼──────────────────────────────────────────────────────────┘
                                              │
                      ┌───────────────────────┴───────────────────────┐
                      ▼                                               ▼
     ┌─────────────────────────────────┐             ┌─────────────────────────────────┐
     │      Prisma DB (SQLite / PG)    │             │   Ethereal Fake SMTP Server     │
     │ Stores Jobs, Quotas, Slack Auth │             │ Returns Live Web Preview URLs   │
     └─────────────────────────────────┘             └─────────────────────────────────┘
```

---

## 🚀 Key Feature Breakdown

| Component | Technology | Implementation Detail |
|---|---|---|
| **Core Scheduler** | BullMQ + Redis | Uses delayed jobs (`delay: timestamp - Date.now()`). **Zero cron jobs.** |
| **Worker Concurrency** | BullMQ Worker | Configurable parallel concurrency (`WORKER_CONCURRENCY=5`). Safe under concurrent workloads. |
| **Provider Throttling** | Async Delay | Configurable inter-email throttle delay (`delaySeconds=2`) to mimic cold outreach delivery. |
| **Hourly Rate Limiter** | Redis Atomic Counters | Sliding/fixed hour window (`ratelimit:sender:{sender}:{YYYY-MM-DD-HH}`). Auto-defers excess jobs to `nextHourStart`. |
| **Slack Notifications** | Slack OAuth 2.0 / Webhooks | Real OAuth authorize flow & direct webhook alerts fired live upon hitting sender hourly rate limit. |
| **Elasticsearch** | `@elastic/elasticsearch` | Indexes subject, body, recipient, sender, status; provides fuzzy multi-match search with highlights & DB fallback. |
| **Queue Visibility** | `@bull-board/express` | Embedded real-time BullMQ dashboard at `/admin/queues`. |
| **SMTP Delivery** | Nodemailer + Ethereal | Multi-sender fake SMTP with live web message preview URLs (`nodemailer.getTestMessageUrl`). |
| **Lead Parser** | `csv-parse` + regex | Parses CSV / TXT files, detects valid emails, and displays live lead count badges. |
| **Auth** | `@react-oauth/google` | Google OAuth login + instant demo evaluation account. |

---

## ⏱ Zero-Cron Scheduling & Idempotency Guarantee

### How BullMQ Delayed Jobs Work (No Cron):
1. When an email or batch is scheduled for a target timestamp $T$:
   $$\text{Delay (ms)} = \max(0, T - \text{Date.now()}) + (i \times \text{delaySeconds} \times 1000)$$
2. BullMQ pushes the job to Redis in a sorted set (ZSET) keyed by epoch timestamp.
3. Redis streams the job to available worker threads the exact millisecond the timer matures.
4. **No cron tick loops**, `node-cron`, `crontab`, or `agenda` are used.

### Idempotency Guarantee:
- Each job is assigned a deterministic Job ID: `jobId: email_{dbId}`.
- Before sending, the worker performs an atomic database state verification. If the email is already `SENT` or `CANCELLED`, execution exits immediately without duplicate transmission.

---

## 🛡 Rate Limiting, Throttling & Auto-Rescheduling

1. **Redis Atomic Counter**:
   - Hourly window key format: `ratelimit:sender:{senderEmail}:{YYYY-MM-DD-HH}`.
   - Redis `INCR` is executed atomically with a 7200-second TTL.
2. **Behavior on Rate Limit Exceeded**:
   - If $\text{count} > \text{MAX\_EMAILS\_PER\_HOUR\_PER\_SENDER}$:
     1. **Do not drop or fail the job**.
     2. Calculate exact start timestamp of next hour window:
        $$\text{nextHourStart} = \text{CurrentHour} + 1 \text{ hour (00:00.000)}$$
     3. Update DB & Elasticsearch status to `RATE_LIMITED_RESCHEDULED`.
     4. Dispatch live Slack Alert via `slackService.sendRateLimitAlert(...)`.
     5. Re-enqueue job delayed to `nextHourStart`, preserving campaign order.

---

## 🔄 Server Restart Resilience

The scheduler survives complete server crashes and restarts without re-sending old emails or dropping future scheduled ones:

1. **Redis Queue Persistence**: BullMQ delayed jobs reside in Redis memory/AOF persistence. When the server restarts, Redis retains all delayed timers.
2. **Startup Synchronization (`syncPendingJobsOnStartup`)**:
   - On boot, backend queries Prisma DB for any jobs in `SCHEDULED`, `RATE_LIMITED_RESCHEDULED`, or `PROCESSING` state.
   - For any job not found in the active BullMQ Redis queue, it dynamically calculates remaining delay:
     $$\text{remainingDelay} = \max(0, \text{job.scheduledAt} - \text{Date.now()})$$
   - It re-enqueues the job with its original deterministic `jobId`, guaranteeing continuous continuity.

---

## 🔔 Slack OAuth & Rate Limit Alert Integration

1. **Slack OAuth Flow**:
   - User clicks **"Connect Slack"** in header / modal $\rightarrow$ redirects to `https://slack.com/oauth/v2/authorize`.
   - Slack redirects to `/api/slack/oauth/callback` with `code`.
   - Backend exchanges `code` for OAuth access token & incoming webhook URL, persisting it per user in `SlackConfig`.
2. **Direct Webhook Support**:
   - Evaluators can paste an incoming webhook URL directly into the modal for instant local evaluation.
3. **Live Alert Dispatch**:
   - When any sender hits the hourly quota, backend sends a formatted Slack Block Kit alert displaying sender email, current volume, hourly quota, and next window timestamp.
   - If Slack is disconnected, scheduler proceeds gracefully without crashing.

---

## 🔍 Elasticsearch Indexing & Search Engine

1. **Mapping Schema**:
   - Index name: `reachinbox_emails`
   - Fields: `id`, `recipient`, `sender`, `subject`, `body`, `status`, `scheduledAt`, `sentAt`, `createdAt`.
2. **Multi-Match Fuzzy Search**:
   - Supports searching across subject (boosted 3x), recipient (boosted 2x), sender, and body with fuzziness.
   - Returns highlighted match snippets (`<mark>...</mark>`).
3. **Seamless DB Fallback**:
   - If Elasticsearch cluster is offline or initializing, search queries automatically fall back to Prisma database filters without API failure.

---

## 📊 Live BullMQ Monitoring Dashboard

An integrated Bull-Board monitoring interface is mounted at `/admin/queues`:
- View active, delayed, waiting, completed, and failed jobs in real-time.
- Inspect job payloads, timestamps, retry attempts, and execution logs.
- Trigger manual retries or clear queues directly from the UI.

---

## 🛠 Getting Started & Local Setup

### Option A: Docker Compose (One-Click Turnkey)

Ensure Docker Desktop is running, then execute:

```bash
# Clone the repository
git clone <your-repo-url>
cd reachinbox-email-scheduler

# Start all services (PostgreSQL, Redis, Elasticsearch, Backend, Frontend)
docker-compose up --build
```

- **Frontend Dashboard**: `http://localhost:5173`
- **Backend API**: `http://localhost:5000`
- **BullMQ Live Dashboard**: `http://localhost:5000/admin/queues`

---

### Option B: Standalone Local Development

#### Prerequisites:
- Node.js v18+ or v20+
- Redis running locally on `localhost:6379` (or cloud Redis / Upstash)

#### 1. Backend Setup:
```bash
cd backend

# Install dependencies
npm install

# Initialize Database (SQLite by default, or PostgreSQL)
npx prisma generate
npx prisma db push

# Start Backend with Hot Reload
npm run dev
```

#### 2. Frontend Setup:
```bash
cd frontend

# Install dependencies
npm install

# Start Vite Dev Server
npm run dev
```

Access the frontend at `http://localhost:5173`.

---

## ⚙️ Environment Variables Reference

### Backend (`backend/.env`):
```env
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:5173

# Database (SQLite by default; PostgreSQL for production)
DATABASE_URL="file:./dev.db"

# Redis
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_PASSWORD=

# Elasticsearch
ELASTICSEARCH_NODE=http://localhost:9200
ELASTICSEARCH_INDEX=reachinbox_emails

# Queue & Worker Settings
WORKER_CONCURRENCY=5
DEFAULT_DELAY_BETWEEN_EMAILS_MS=2000
MAX_EMAILS_PER_HOUR_PER_SENDER=50

# Google OAuth
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Slack OAuth & Webhook
SLACK_CLIENT_ID=
SLACK_CLIENT_SECRET=
SLACK_REDIRECT_URI=http://localhost:5000/api/slack/oauth/callback
DEFAULT_SLACK_WEBHOOK_URL=

# Ethereal SMTP (Leave blank to auto-generate test accounts dynamically)
ETHEREAL_USER=
ETHEREAL_PASS=
```

---

## 📡 API Specification

### Email Management
- `POST /api/emails/schedule` — Schedule a single email or batch lead campaign.
- `POST /api/emails/parse-leads` — Upload and parse `.csv` or `.txt` email list.
- `GET /api/emails/scheduled` — Fetch scheduled & rate-limited emails.
- `GET /api/emails/sent` — Fetch sent emails with Ethereal preview URLs.
- `GET /api/emails/search?q=:query` — Elasticsearch full-text search with highlight snippets.
- `DELETE /api/emails/:id` — Cancel a scheduled job and remove it from BullMQ.

### Slack Integration
- `GET /api/slack/oauth/start` — Initiate Slack OAuth 2.0 redirect.
- `GET /api/slack/oauth/callback` — Slack OAuth exchange handler.
- `POST /api/slack/webhook` — Save incoming webhook URL.
- `GET /api/slack/status` — Get integration status.
- `POST /api/slack/test` — Send live test alert to Slack.
- `POST /api/slack/disconnect` — Disconnect Slack.

### Analytics & Auth
- `GET /api/stats/overview` — Aggregated counts, BullMQ queue stats, rate limit info.
- `GET /api/stats/sender/:email` — Hourly quota usage for a specific sender.
- `POST /api/auth/google` — Google OAuth credential verification.

---

## 🎬 Step-by-Step Demo & Verification Script

### 1. Creating Scheduled Emails & Lead Import
1. Navigate to `http://localhost:5173` and sign in (via Google or instant Demo button).
2. Click **"Compose New Email"**.
3. Drag & drop `leads.csv` into the uploader — notice instant badge: *"10 valid email leads detected"*.
4. Select a start time (immediate or scheduled in future) and click **"Schedule Campaign"**.
5. Observe confetti animation and immediate appearance of jobs in the **Scheduled Emails** table.

### 2. Live Delivery & Viewing Ethereal Inboxes
1. Watch the **Scheduled Emails** table transition jobs to `PROCESSING` and then `SENT`.
2. Switch to the **Sent Emails** tab.
3. Click the **"View Email"** button next to any sent email $\rightarrow$ it opens the live fake SMTP web preview in Ethereal Email showing the exact rendered HTML body!

### 3. Demonstrating Rate Limiting & Slack Alert
1. In `backend/.env`, set `MAX_EMAILS_PER_HOUR_PER_SENDER=3`.
2. Connect Slack in the dashboard (via OAuth or paste your webhook URL).
3. Schedule 6 emails for `sales@outboxlabs.com`.
4. Observe the first 3 emails deliver successfully; the 4th, 5th, and 6th emails are automatically marked `RATE_LIMITED_RESCHEDULED` for the start of the next hour window.
5. Check your Slack channel: a live formatted rate limit alert message arrives instantly!

### 4. Demonstrating Server Restart Resilience
1. Schedule 5 emails for 1 minute into the future.
2. Terminate the backend process (`Ctrl + C` or stop container).
3. Wait 20 seconds and start backend again (`npm run dev`).
4. Notice startup log: `✨ All pending jobs are already safely persisted in BullMQ Redis store`.
5. At the exact target time, BullMQ fires and all emails are delivered without duplication.

---

## 💡 Assumptions & Design Trade-offs

1. **Ethereal Dynamic Account Generation**: If `ETHEREAL_USER` and `ETHEREAL_PASS` are omitted in `.env`, the service automatically calls `nodemailer.createTestAccount()` on boot. This ensures zero configuration is required for reviewers.
2. **Sliding Hour Windows vs Exact Sliding Token Bucket**: We use Redis-backed hour keys (`YYYY-MM-DD-HH`) with atomic increments and 2-hour TTLs. This matches standard email provider quota structures (e.g. Amazon SES, SendGrid hourly sending limits).
3. **Elasticsearch Fallback**: For environments where Elasticsearch is not running, the application gracefully routes searches to Prisma database `LIKE` queries with zero downtime.
