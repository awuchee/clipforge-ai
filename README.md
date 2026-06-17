# VixClip AI

AI Ad Video Generator + AI Clip Repurposing SaaS — turn long videos/podcasts into viral
short clips with auto highlight detection, captions, and social-ready exports, and
(roadmap) turn a product description into ready-to-post ad scripts and short ad videos.

This repo contains the **foundation + async AI processing pipeline**: authentication,
dashboard shell, storage/upload, and a Redis/BullMQ job queue + worker service that
transcribes videos (Whisper), detects viral moments, renders 9:16 clips with burned-in
captions (FFmpeg), and generates hook titles/hashtags/virality scores (GPT). Stripe billing
(Free/Pro plans, checkout, webhooks, usage limits) is included; Google OAuth is not yet
implemented.

The existing clip-repurposing pipeline (above) is unchanged. A second product surface —
**AI ad generation** — is being scaffolded alongside it; see
[Ad generation architecture](#ad-generation-architecture-roadmap) below.

For a step-by-step production environment setup, startup checklist, and
troubleshooting guide, see [SETUP.md](SETUP.md).

## Project structure

```
VixClip AI/
├── backend/    NestJS API (Auth, Users, Projects, Clips) + Prisma/PostgreSQL
│                + BullMQ worker process (video processing pipeline)
└── frontend/   Next.js 14 (App Router) + Tailwind + ShadCN-style UI
```

## Prerequisites

- Node.js 20+
- PostgreSQL (local or hosted, e.g. Supabase/Neon/Railway) — **required**
- Redis (local or hosted, e.g. Upstash/Railway) for the job queue — required for the
  queue/worker, but the API will still boot without it (with a warning)
- Optional: Docker (to run local Postgres + Redis via `docker-compose.yml`)
- Optional: an S3-compatible storage bucket (Cloudflare R2 or AWS S3). If not configured,
  the system automatically falls back to **local disk storage** served from the API at
  `/files/<key>`
- An OpenAI API key (`OPENAI_API_KEY`) — **required** for video processing. Whisper
  transcription has no offline fallback and processing jobs fail without it. Viral
  metadata generation (hook titles, hashtags, scores) falls back to offline
  heuristics if the key is missing, but transcription does not.

## Quick start

For a full copy-paste walkthrough (Docker → `.env` → install → migrate →
run), see [SETUP.md](SETUP.md#2-first-run-copy-paste). Short version:

```bash
docker compose up -d
cp backend/.env.example backend/.env          # then set JWT_SECRET, OPENAI_API_KEY
cp frontend/.env.local.example frontend/.env.local
npm install
npm run prisma:generate --workspace=backend
npm run prisma:migrate --workspace=backend
npm run dev      # starts frontend, API, and worker with WEB/API/WORKER logs
```

### Individual services

```bash
npm run dev:web     # frontend only      → http://localhost:3000
npm run dev:api     # backend API only   → http://localhost:4000/api
npm run dev:worker  # worker only        → http://localhost:4100/worker-health
npm run services:up   # docker compose up -d postgres redis
npm run services:down # docker compose down
```

## Health checks

- `GET http://localhost:4000/health` — API liveness: database + Redis connectivity
- `GET http://localhost:4000/system-status` — combined view: database, Redis, worker
  (via heartbeat), and BullMQ queue job counts for both queues
- `GET http://localhost:4100/worker-health` — worker liveness + queue job counts
  (`WORKER_PORT`, defaults to `4100`)

## Backend setup

See [SETUP.md](SETUP.md) for `.env` setup and startup steps. The API and
worker are separate processes that must both connect to the same Postgres
database and Redis instance for end-to-end processing to work.

### Storage configuration

Uploads are written to an S3-compatible bucket via `S3_ENDPOINT`/`S3_BUCKET`/
`S3_ACCESS_KEY_ID`/`S3_SECRET_ACCESS_KEY`/`S3_REGION`. Set `S3_PUBLIC_URL` to the
base URL clients should use to fetch files (e.g. a R2 public bucket URL or custom
domain) — `videoUrl` is built from this plus the object key.

**Local fallback mode**: if `S3_ACCESS_KEY_ID`/`S3_SECRET_ACCESS_KEY`/`S3_BUCKET` are
not all set (and `STORAGE_DRIVER` isn't explicitly `s3`), the API and worker
automatically use local disk storage under `backend/storage-data/` (configurable via
`STORAGE_LOCAL_DIR`), served at `http://localhost:4000/files/<key>`. Set
`STORAGE_DRIVER=local` / `STORAGE_DRIVER=s3` to force a driver explicitly.

### Environment validation

On startup, both the API and worker validate `backend/.env`:

- **`DATABASE_URL` missing** → throws and aborts startup with a clear error message
- **`REDIS_URL`/`REDIS_HOST` missing** → warns and defaults to `127.0.0.1:6379`
- **S3 credentials incomplete** → warns and falls back to local disk storage (see above)
- **`OPENAI_API_KEY` missing** → warns; viral metadata falls back to offline
  heuristics, but Whisper transcription has no fallback and video processing
  jobs will fail until the key is set

### Auth endpoints

- `POST /api/auth/register` — `{ name, email, password }` → `{ user, accessToken }`
- `POST /api/auth/login` — `{ email, password }` → `{ user, accessToken }`
- `GET /api/auth/me` — requires `Authorization: Bearer <token>`

### Project endpoints

- `GET /api/projects` — list current user's projects (with clips)
- `GET /api/projects/:id` — get one project (with clips)
- `GET /api/projects/:id/status` — lightweight polling endpoint:
  `{ id, status, durationSec, errorMessage, clipCount, updatedAt }`
- `GET /api/projects/:id/clips` — list clips for a project, sorted by virality score
- `POST /api/projects` — `{ title, sourceType, sourceUrl? }`
  - `sourceType: YOUTUBE` → project is created with `status: QUEUED` and a
    processing job is enqueued immediately
  - `sourceType: UPLOAD_VIDEO | UPLOAD_AUDIO` → project is created with
    `status: PENDING`; call the upload endpoint next
- `POST /api/projects/:id/upload` — multipart form, field `file` (video/* or audio/*)
  - Uploads the file to storage, updates the project (`videoUrl`,
    `originalFilename`, `storageKey`, `status: UPLOADED`), and enqueues a
    processing job

### Clip endpoints

- `GET /api/clips/:id` — get one clip (with `videoUrl`/`thumbnailUrl`/`srtUrl`)
- `GET /api/clips/:id/metadata` — downloadable JSON summary (hook titles,
  hook variations, description, hashtags, virality/quality scores, caption
  theme, duration)

### Processing pipeline (worker)

Each enqueued project moves through `UPLOADED`/`QUEUED` → `PROCESSING` → `DONE`/`FAILED`.
The worker (`npm run dev:worker`):

1. Downloads the source video (from S3/R2, or via `yt-dlp` for YouTube projects)
2. Transcribes it with OpenAI Whisper (word-level timestamps)
3. Scores sliding windows of the transcript for "viral moment" potential
   (emotional language, hook phrasing, engagement cues, pacing), discards
   windows with too little spoken content (`MIN_TRANSCRIPT_WORDS`), and picks
   3-10 non-overlapping highlights
4. For each highlight:
   - Generates 10 hook title variations across 4 styles (curiosity,
     authority, shock, storytelling), a description, hashtags, a 0-100
     virality score, platform suggestion, and selection reason via GPT
     (falls back to heuristics without an OpenAI key)
   - **Quality filter**: clips below `MIN_VIRAL_SCORE` or `MIN_QUALITY_SCORE`
     are rejected (`status: REJECTED`) and never rendered/uploaded - only the
     strongest clips reach the results page
   - Cuts the highlight and reframes it to 9:16 (1080x1920) with FFmpeg. A
     motion-analysis pass (`SmartReframeService`) tracks the most active
     region of the frame (the likely speaker) and pans the crop smoothly
     toward it, with a max-pan-rate clamp so the camera never jumps; falls
     back to a static center-crop if no motion is detected
   - Burns in word-by-word animated captions using one of four reusable
     caption themes (`bold`, `minimal`, `neon`, `classic` - rotated per clip
     or pinned via `CAPTION_THEME`), with active-word highlighting, bold/emoji
     emphasis for high-energy words, and automatic line breaking, and exports
     a matching `.srt` file
   - Extracts the strongest frame and overlays the top hook title as a
     thumbnail (`ThumbnailService`)
   - Uploads the rendered clip, thumbnail, and `.srt` to storage and creates
     a `Clip` row
5. Re-processing a project deletes previously-uploaded clip assets from
   storage before regenerating
6. Marks the project `DONE` (or `FAILED` with `errorMessage` set on error)

Quality-filter and caption-theme thresholds are configurable via
`MIN_VIRAL_SCORE`, `MIN_QUALITY_SCORE`, `MIN_TRANSCRIPT_WORDS`, and
`CAPTION_THEME` (see `.env.example`).

## Frontend setup

See [SETUP.md](SETUP.md) — set `NEXT_PUBLIC_API_URL` in
`frontend/.env.local` to the API's `/api` base URL, then `npm run dev:web`
(or run everything together with `npm run dev` from the repo root).

## What's included

- Email/password auth (JWT) with register, login, and session restore
- Dashboard shell (sidebar, navbar, account menu)
- Project list + "new project" creation:
  - YouTube URL → project created with `status: QUEUED`, processing job enqueued
  - Video/audio upload → drag-and-drop dropzone with progress bar, uploads
    to S3/R2 via `/projects/:id/upload`, project moves to `status: UPLOADED`
    and a processing job is enqueued
- Redis/BullMQ `video-processing-queue` (producer in the API, consumer in a
  separate worker process) with retries and exponential backoff
- Full async processing pipeline: Whisper transcription, sliding-window
  viral moment detection, FFmpeg 9:16 clip rendering with burned-in
  word-by-word captions, SRT export, and GPT-generated hook
  titles/hashtags/virality scores
- Project detail page with a real `<video>` player, live status polling
  (`UPLOADED` → `QUEUED` → `PROCESSING` → `DONE`/`FAILED`), and a clip grid
  with thumbnails, durations, virality scores, and a preview modal showing
  alternate hook titles (grouped by style), copy buttons for the title/
  description/hashtags, and download buttons for the MP4, `.srt`, thumbnail,
  and a metadata `.json`
- Dark-mode landing page (hero, features, pricing, testimonials)
- In-browser clip editor: trim/hook/caption-theme edits trigger a re-render
  via the `clip-render-queue`, plus downloads for the MP4, `.srt`, thumbnail,
  and metadata `.json`
- Prisma schema modeling `User`, `Project`, and `Clip` (transcripts, clip
  metadata, hook variations, virality/quality scores, caption theme, errors,
  and processing status incl. `REJECTED` for clips filtered out by the
  quality gate)

### Billing endpoints

- `POST /api/billing/checkout` — creates a Stripe Checkout Session (subscription
  mode, Pro plan) for the authenticated user and returns `{ url }`
- `POST /api/billing/portal` — creates a Stripe Billing Portal session for
  managing/cancelling a subscription, returns `{ url }`
- `POST /api/billing/webhook` — Stripe webhook (raw body, signature-verified):
  handles `checkout.session.completed`, `customer.subscription.updated`,
  `customer.subscription.created`, and `customer.subscription.deleted` to
  keep `User.plan`/`subscriptionStatus`/`stripeSubscriptionId`/`currentPeriodEnd`
  in sync

FREE-plan accounts are limited to 3 video imports/month (`videosUsedThisMonth`,
reset on a rolling 30-day window) and clip exports are watermarked. PRO accounts
are unlimited and watermark-free. Hitting the FREE limit returns a
`PLAN_LIMIT_REACHED` error code, which the frontend uses to show an upgrade modal.

## Not yet implemented (see full spec)

- Google OAuth login
