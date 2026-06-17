# VixClip AI — Deployment Guide

Target stack: **Vercel** (frontend), **Railway or Render** (backend API + worker,
two services from the same repo), **Supabase** (Postgres), **Upstash** (Redis).

---

## 0. Before you start

- Push this repo to GitHub (Vercel/Railway/Render all deploy from a git remote).
- Have ready: a Supabase project, an Upstash Redis database, an OpenAI API key,
  and (optional but recommended before launch) a Stripe account with a Pro
  recurring price.

---

## 1. Database — Supabase Postgres

1. Create a new Supabase project.
2. Get the connection string from **Project Settings → Database → Connection
   string** (use the **pooled (PgBouncer, port 6543)** connection string for
   the app's `DATABASE_URL`, since both the API and worker will hold Prisma
   connection pools).
3. Run migrations **once**, from a machine that can reach the Supabase DB
   (locally, or as a one-off Railway/Render job):

   ```bash
   cd backend
   DATABASE_URL="<supabase-connection-string>" npx prisma migrate deploy
   ```

   This applies the single baseline migration (`20260101000000_init`) which
   creates `users`, `projects`, `clips`, and `processed_stripe_events` plus
   all enums/indexes/foreign keys — no shadow database is needed for
   `migrate deploy`.

4. Re-run `npx prisma migrate deploy` (same command) after every future schema
   change, before redeploying the API/worker.

---

## 2. Cache / Queue — Upstash Redis

1. Create an Upstash Redis database (any region close to your Railway/Render
   region).
2. Copy the **TLS connection string** (`rediss://default:<password>@<host>:<port>`).
3. Set this as `REDIS_URL` for **both** the API and worker services — they
   must point at the same Redis instance or queued jobs will never be picked
   up.

---

## 3. Object Storage — required for production (S3 / Cloudflare R2)

The backend's "local disk" storage mode (`STORAGE_DRIVER=local`) writes files
to `backend/storage-data/` on the local filesystem. **This does not work on
Railway/Render**: the API and worker run as separate services/containers with
no shared disk, and most platforms use ephemeral filesystems that are wiped on
redeploy. You **must** configure S3-compatible storage:

1. Create a Cloudflare R2 bucket (or AWS S3 bucket).
2. Generate an access key/secret with read/write access to the bucket.
3. If using R2, enable public access (or a custom domain) for the bucket and
   note the public base URL.
4. Set `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_REGION`,
   `S3_ENDPOINT` (R2 only), and `S3_PUBLIC_URL` on **both** the API and worker
   services.

---

## 4. Backend — Railway / Render (two services)

The backend is one NestJS codebase with two entry points: the API
(`dist/main.js`) and the worker (`dist/worker/main.js`). Deploy them as **two
separate services** pointing at the same repo/subdirectory, sharing the same
environment variables (Postgres, Redis, S3, OpenAI, Stripe, JWT secret).

### Shared build step (both services)

```bash
npm install
npm run prisma:generate --workspace=backend
npm run build --workspace=backend
```

### Service A — API

- **Start command:** `node backend/dist/main.js`
- **Port:** `4000` (or platform-assigned `$PORT` — the app reads `PORT` from env)
- **Health check path:** `/health`

### Service B — Worker

- **Start command:** `node backend/dist/worker/main.js`
- **Port:** `WORKER_PORT` (defaults to `4100`)
- **Health check path:** `/worker-health`

### Notes

- Both services need `DATABASE_URL`, `REDIS_URL`, and the S3 vars — jobs
  created by the API are processed by the worker, and both write to the same
  Postgres database.
- Run `npx prisma migrate deploy` (Section 1) **before** starting these
  services on a fresh database — Railway/Render "Deploy" hooks or a one-off
  job/shell are good places for this.
- Set `FRONTEND_URL` to your Vercel production URL — this is used for CORS
  (`app.enableCors`) and for Stripe checkout/portal `success_url`/`return_url`.
- Set `API_BASE_URL` to the **public URL of Service A** — only relevant if you
  end up on `STORAGE_DRIVER=local` for some reason (not recommended; see
  Section 3).

---

## 5. Frontend — Vercel

1. Import the repo into Vercel, set the **Root Directory** to `frontend/`.
2. Framework preset: Next.js (auto-detected).
3. Build command / output: defaults (`next build`).
4. Set environment variable:
   - `NEXT_PUBLIC_API_URL=https://<your-api-service-domain>/api`
5. Deploy. After the backend's `FRONTEND_URL` is updated to this Vercel URL,
   redeploy the backend so CORS picks up the new origin.

---

## 6. Stripe webhook (production)

After both services are live:

1. In the Stripe Dashboard, add a webhook endpoint pointing to
   `https://<api-domain>/api/billing/webhook`.
2. Subscribe to: `checkout.session.completed`, `customer.subscription.created`,
   `customer.subscription.updated`, `customer.subscription.deleted`.
3. Copy the signing secret into `STRIPE_WEBHOOK_SECRET` on the API service
   (the worker doesn't need Stripe vars).
4. Set `STRIPE_SECRET_KEY` and `STRIPE_PRICE_PRO_ID` (live keys/price) on the
   API service and redeploy.

---

## 7. Environment variables checklist

### Backend — API service (Railway/Render)

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | ✅ | Supabase pooled connection string |
| `REDIS_URL` | ✅ | Upstash `rediss://...` URL |
| `JWT_SECRET` | ✅ | Long random string |
| `JWT_EXPIRES_IN` | optional | Defaults to `7d` |
| `PORT` | optional | Platform usually injects this |
| `FRONTEND_URL` | ✅ | Vercel production URL (CORS + Stripe redirect URLs) |
| `API_BASE_URL` | optional | Only used by local storage fallback |
| `STORAGE_DRIVER` | recommended | Set to `s3` explicitly in production |
| `S3_BUCKET` / `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` / `S3_REGION` / `S3_ENDPOINT` / `S3_PUBLIC_URL` | ✅ | R2/S3 credentials (Section 3) |
| `MAX_UPLOAD_SIZE_MB` | optional | Defaults to 2048 |
| `OPENAI_API_KEY` | ✅ | Required for Whisper transcription |
| `STRIPE_SECRET_KEY` | recommended | Required for Pro upgrades |
| `STRIPE_WEBHOOK_SECRET` | recommended | Required for webhook signature verification |
| `STRIPE_PRICE_PRO_ID` | recommended | Pro plan price ID |

### Backend — Worker service (Railway/Render)

Same as API **except** Stripe vars are not needed:

| Variable | Required |
|---|---|
| `DATABASE_URL`, `REDIS_URL`, S3 vars, `OPENAI_API_KEY` | ✅ |
| `WORKER_PORT` | optional (defaults to `4100`) |
| `WORKER_TMP_DIR` | optional |
| `MAX_CLIPS_PER_VIDEO`, `MIN_CLIPS_PER_VIDEO`, `MIN_VIRAL_SCORE`, `MIN_QUALITY_SCORE`, `MIN_TRANSCRIPT_WORDS`, `CAPTION_THEME` | optional, tuning only |

### Frontend — Vercel

| Variable | Required |
|---|---|
| `NEXT_PUBLIC_API_URL` | ✅ — `https://<api-domain>/api` |

---

## 8. Post-deploy verification

```bash
curl https://<api-domain>/health           # database + redis "ok"
curl https://<api-domain>/system-status    # + worker heartbeat, queue counts
curl https://<worker-domain>/worker-health
```

Then open the Vercel URL, register an account, and create a project (YouTube
URL is the simplest first test — no upload/storage round trip required) and
confirm it reaches `status: DONE`.
