# VixClip AI — Environment Setup Guide

A short, copy-paste guide to configure and run VixClip AI.

## 1. Requirements

- Node.js 20+
- Docker Desktop (for local Postgres + Redis)
- An OpenAI API key
- Windows users: run these commands in **WSL** or **Git Bash**. Plain
  PowerShell works for everything except the `cp` commands — use
  `Copy-Item` instead (shown below).

## 2. First run (copy-paste)

Run these in order. Each step lists what you should see if it worked.

### Step 1 — Start Postgres + Redis

```bash
docker compose up -d
```

**Expected output:** two containers created and `running`/`healthy`:
```
✔ Container vixclip-postgres   Healthy
✔ Container vixclip-redis      Healthy
```

### Step 2 — Create your `.env` files

macOS / Linux / WSL / Git Bash:
```bash
cp backend/.env.example backend/.env
cp frontend/.env.local.example frontend/.env.local
```

Windows PowerShell:
```powershell
Copy-Item backend/.env.example backend/.env
Copy-Item frontend/.env.local.example frontend/.env.local
```

**Expected output:** no output (files are silently created). Confirm with
`ls backend/.env frontend/.env.local`.

Now open `backend/.env` and set at minimum:
- `JWT_SECRET` — any long random string
- `OPENAI_API_KEY` — your OpenAI key (see [Section 5](#5-openai-setup))

Leave everything else as default for a first run.

### Step 3 — Install dependencies

```bash
npm install
```

**Expected output:** ends with `added N packages` and no `npm error` lines.

### Step 4 — Create database tables

```bash
npm run prisma:generate --workspace=backend
npm run prisma:migrate --workspace=backend -- --name init
```

**Expected output:**
- `prisma:generate` → `✔ Generated Prisma Client`
- `prisma:migrate` → creates `backend/prisma/migrations/<timestamp>_init/`
  and prints `Your database is now in sync with your schema`

### Step 5 — Start the app

```bash
npm run dev
```

**Expected output:** color-coded `WEB` / `API` / `WORKER` logs, ending with
each service ready:
```
API    [Nest] Nest application successfully started
WORKER [Worker] VixClip worker running — listening for queue jobs
WEB    ▲ Next.js ready on http://localhost:3000
```

Note: `npm run dev` also re-creates missing `.env` files and re-runs
`prisma generate` automatically — Steps 2 and 4's `prisma:generate` are safe
to skip if you're in a hurry, but running migrations (Step 4) is still
required before the app can use the database.

### Step 6 — Verify

```bash
curl http://localhost:4000/health
```

**Expected output:** `{"status":"ok", ...}` with `database` and `redis` both
`"ok"`.

Then open http://localhost:3000, sign up, and create a project (upload a
short video or paste a YouTube URL). It should reach `status: DONE` with
generated clips within a few minutes.

## 3. Environment variables by service

### Database (Postgres) — required

```ini
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/vixclip?schema=public"
```

### Redis — required

```ini
REDIS_URL=""              # e.g. redis://localhost:6379 — takes priority if set
REDIS_HOST="127.0.0.1"
REDIS_PORT=6379
REDIS_PASSWORD=""
```

Used by both the API (adds jobs) and the worker (processes jobs). They must
point to the **same** Redis instance.

### OpenAI — required

```ini
OPENAI_API_KEY=""
```

Powers Whisper transcription (required, no fallback) and hook/hashtag
generation (has an offline fallback if unset, but transcription does not).

### Auth — required

```ini
JWT_SECRET="change-me-to-a-long-random-string"
JWT_EXPIRES_IN="7d"
```

### App URLs

```ini
PORT=4000
FRONTEND_URL="http://localhost:3000"
API_BASE_URL="http://localhost:4000"
```

```ini
# frontend/.env.local
NEXT_PUBLIC_API_URL=http://localhost:4000/api
```

### Storage (S3 / R2) — optional

```ini
STORAGE_DRIVER=""          # "s3" | "local" — auto-detected if blank
STORAGE_LOCAL_DIR=""
S3_ENDPOINT=""
S3_BUCKET="vixclip-uploads"
S3_ACCESS_KEY_ID=""
S3_SECRET_ACCESS_KEY=""
S3_REGION="auto"
S3_PUBLIC_URL=""
MAX_UPLOAD_SIZE_MB=2048
```

Leave blank to use local disk storage (`backend/storage-data/`, served at
`/files/<key>`). Use S3/R2 for multi-instance production deployments.

### Worker + pipeline tuning — optional, safe defaults

```ini
WORKER_PORT=4100
WORKER_TMP_DIR=""
MAX_CLIPS_PER_VIDEO=10
MIN_CLIPS_PER_VIDEO=3
MIN_VIRAL_SCORE=35
MIN_QUALITY_SCORE=0.15
MIN_TRANSCRIPT_WORDS=8
CAPTION_THEME=""
```

### Billing (Stripe) — optional

```ini
STRIPE_SECRET_KEY=""
STRIPE_WEBHOOK_SECRET=""
STRIPE_PRICE_PRO_ID=""
```

Without `STRIPE_SECRET_KEY`/`STRIPE_PRICE_PRO_ID`, all accounts behave as FREE
plan (3 videos/month, watermarked exports) and `/billing/checkout` returns an
error. To enable Pro upgrades:

1. Create a recurring "Pro" price in the Stripe Dashboard and set its ID as
   `STRIPE_PRICE_PRO_ID`.
2. Set `STRIPE_SECRET_KEY` (test or live secret key).
3. Forward webhooks to the API during local development:
   `stripe listen --forward-to localhost:4000/api/billing/webhook`, then set
   `STRIPE_WEBHOOK_SECRET` to the signing secret it prints.

## 4. Redis setup notes

- **Local:** `docker compose up -d` starts Redis on `localhost:6379` — no
  further config needed, defaults already match.
- **Hosted (Upstash/Railway/ElastiCache):** set `REDIS_URL` to the full
  connection string. Use `rediss://` (with two `s`) if the provider requires
  TLS.
- The API and worker are **separate processes** that both read this config —
  if they point to different Redis instances, jobs created by the API will
  never be picked up by the worker.

## 5. OpenAI setup

1. Create a key at https://platform.openai.com/api-keys with access to
   `whisper-1` and a chat model (e.g. `gpt-4o-mini`).
2. Set `OPENAI_API_KEY` in `backend/.env`.
3. Restart the worker (`npm run dev:worker`, or restart `npm run dev`).

Without this key, **every video processing job fails immediately** at the
transcription step — there is no offline transcription fallback by design.

## 6. YouTube import setup

No extra configuration needed — YouTube downloads use `yt-dlp` (bundled via
`yt-dlp-exec`, installed automatically with `npm install`).

- Works for any public, non-age-restricted, non-private YouTube video.
- Private, removed, age-restricted, members-only, or copyright-blocked videos
  fail permanently with a clear message in `project.errorMessage` — this is
  expected, not a bug.
- Transient network failures are retried automatically (3 attempts).
- If most/all YouTube URLs suddenly start failing, YouTube likely changed
  something upstream — run `npm update yt-dlp-exec --workspace=backend`.

## 7. Production startup checklist

1. Provision managed Postgres + Redis (not the local Docker containers).
2. Set `backend/.env`: `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`,
   `OPENAI_API_KEY`, and S3/R2 credentials (recommended for production).
3. `npm install`
4. `npm run prisma:generate --workspace=backend`
5. `npm run prisma:migrate --workspace=backend` (run once per deploy, before
   starting the API or worker)
6. `npm run build --workspace=backend && npm run build --workspace=frontend`
7. Start, in any order (all require Postgres + Redis already reachable):
   - `node backend/dist/main` — API (`:4000`)
   - `node backend/dist/worker/main` — worker (`:4100`)
   - `npm run start --workspace=frontend` — frontend (`:3000`)
8. Verify `GET /health`, `GET /system-status`, `GET :4100/worker-health` all
   return `"status":"ok"`.

## 8. Common mistakes

1. **API and worker point to different databases or Redis instances.**
   Both processes read `backend/.env` — if you run them with different
   environments (e.g. different `.env` files or shells), jobs get created
   but never processed. Symptom: project stuck on `QUEUED`/`PROCESSING`
   forever.

2. **Forgetting to run migrations.**
   The API starts fine but every request that touches the database fails
   with a Prisma error (`relation "User" does not exist`). Fix: `npm run
   prisma:migrate --workspace=backend`.

3. **No `OPENAI_API_KEY` set.**
   Everything *looks* like it's working (upload succeeds, project goes to
   `PROCESSING`) but it always ends in `FAILED` with an OpenAI error. This is
   required, not optional.

4. **`NEXT_PUBLIC_API_URL` not set or wrong.**
   Frontend loads, but login/signup/project actions fail silently or show
   network errors. Must match the API's actual reachable URL, including
   `/api`.

5. **Docker containers not actually running before `npm run dev`.**
   `npm run dev` tries to start Postgres/Redis via Docker but continues even
   if that fails — if Docker Desktop wasn't running, the API/worker will log
   connection errors. Run `docker compose ps` first to confirm both
   containers are `healthy`.

## 9. System architecture overview

```
Browser (Next.js frontend, :3000)
   │  REST calls (NEXT_PUBLIC_API_URL)
   ▼
NestJS API (:4000) ──┬──► Postgres (users, projects, clips)
   │ enqueues jobs    └──► Storage (local disk or S3/R2)
   ▼
Redis (BullMQ queues: video-processing, clip-render)
   ▼
Worker process (:4100) ──► yt-dlp (YouTube) / storage (uploads)
   │                  ──► OpenAI Whisper (transcription)
   │                  ──► OpenAI GPT (hook titles, hashtags, scores)
   └──► FFmpeg (clip rendering, captions, thumbnails) ──► Storage
```

The API and worker are independent Node processes that share the same
Postgres database and Redis instance. The API handles requests and enqueues
jobs; the worker processes them asynchronously and writes results back to
Postgres and storage.
