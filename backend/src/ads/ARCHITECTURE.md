# Ad generation architecture

VixClip's second product surface, alongside the existing clip-repurposing
pipeline (`ProjectsModule` / `ClipsModule` / `WorkerModule`, unchanged).

Both plan generation (strategy, script, scene breakdown, visual/audio
direction, social captions) and **video rendering are implemented**. Ad
projects are persisted (`AdProject` Prisma model), rendered asynchronously via
a dedicated BullMQ queue/worker, and stored alongside their thumbnails and
subtitle tracks.

## Feature areas

### 0. Shared plan generation (`common/`)

`AdGenerationService.generatePlan({ productName, productDescription, targetAudience?, tone? })`
calls GPT (`gpt-4o-mini`, JSON mode) with the "VixClip AI Ad Video Generator"
system prompt to produce an `AdVideoPlan`: `adStrategy`, `script`
(hook/problem/solution/benefits/callToAction), `scenes[]`
(sceneNumber/durationSeconds/visualDescription/onScreenText/voiceover/transitionType),
`visualDirection`, `audioDirection`, and `socialOutput` (per-platform captions
+ hashtags). Falls back to a deterministic offline plan when
`OPENAI_API_KEY` is unset or the API call fails, mirroring
`ViralMetadataService`'s pattern. Used by both `ad-scripts` and `ad-projects`.

### 1. Ad Templates (`ad-templates/`)

Static catalog of ad formats, defined in `ad-templates.constants.ts`. Each
template specifies platform, aspect ratio, max duration, and an ordered list
of script "beats" (`hook`, `problem`, `solution`, `demo`, `social_proof`,
`cta`). Both the script generator and ad project generator key off a `templateId`.

`GET /api/ads/templates` — list templates (optionally `?platform=TIKTOK`)
`GET /api/ads/templates/:id` — get one template

Initial templates: `tiktok-direct-response`, `instagram-reels-aspirational`,
`youtube-shorts-explainer`.

### 2. AI Ad Script Generator (`ad-scripts/`)

`POST /api/ads/scripts/generate` — `{ productName, productDescription, targetAudience?, tone?, templateId }`

Returns `AdScriptResult { templateId, adStrategy, script }` — the strategy and
hook/problem/solution/benefits/CTA script from the shared plan. Stateless
(not persisted) — a quick preview/iteration tool.

### 3. AI Product Ad Video Generator (`ad-projects/`)

Persisted, stateful ad projects with an end-to-end render pipeline:

- `POST /api/ads/projects` — `{ productName, productDescription, templateId, targetAudience?, tone?, productImageUrls? }`
  creates an `AdProject` (status `DRAFT`).
- `POST /api/ads/projects/:id/plan` — generates the structured `AdVideoPlan`
  via `AdGenerationService`, stores it on the project, sets status `PLAN_READY`.
- `POST /api/ads/projects/:id/render` — validates a plan exists, sets status
  `QUEUED`, and enqueues a job on `ad-video-render-queue`.
- `GET /api/ads/projects/:id/status` — lightweight polling
  (`status`, `errorMessage`, `videoUrl`, `thumbnailUrl`, `durationSec`).
- `GET /api/ads/projects` — list the user's ad projects.
- `GET /api/ads/projects/:id` — get one ad project (full record incl. plan).

#### Rendering flow (`AdVideoRenderProcessor`, `worker/processors/ad-video-render.processor.ts`)

For each scene in `plan.scenes`:

1. **Voiceover** — `TextToSpeechService` (OpenAI TTS, voice chosen from
   `audioDirection.voiceGenderSuggestion`) synthesizes `scene.voiceover` to
   mp3. Requires `OPENAI_API_KEY`, no offline fallback (mirrors
   `TranscriptionService`).
2. **Timing** — `FfmpegService.probeDuration` measures the synthesized audio;
   `evenlySplitWords` (in `caption.service.ts`) distributes the voiceover text
   evenly across that duration to produce `TranscriptWord[]`.
3. **Captions** — `CaptionService.buildAss` burns word-by-word captions
   ("bold" theme, bottom-aligned) for the scene.
4. **Scene render** — `FfmpegService.renderAdScene` composites: a Ken-Burns-panned
   product image (cycled from `productImageUrls`, if provided) or a solid
   color background (cycled palette), the scene's `onScreenText` via
   `drawtext`, the burned ASS captions, and the muxed voiceover audio. Output
   is 1080x1920 h264/aac, duration matched to the voiceover.

After all scenes:

5. **Concatenation** — `FfmpegService.concatVideos` joins the per-scene videos
   (concat demuxer, stream copy) into the final ad video.
6. **Thumbnail** — `FfmpegService.generateThumbnail` + `ThumbnailService` overlay
   the script's `hook` text on a frame from the final video.
7. **Subtitles** — a combined `.srt` is built from the per-scene word lists
   with cumulative time offsets across the full timeline.
8. **Upload + persist** — video/thumbnail/srt are uploaded via `StorageService`
   to `ads/<adProjectId>/...`; the `AdProject` is updated with
   `storageKey`/`thumbnailKey`/`srtKey`/`videoUrl`/`durationSec` and status
   `DONE` (or `FAILED` with `errorMessage` on error).

## Data model

`AdProject` (`@@map("ad_projects")`, migration `20260615000000_add_ad_projects`):
`id`, `templateId`, `productName`, `productDescription`, `targetAudience?`,
`tone?`, `productImageUrls: String[]`, `status: AdProjectStatus`
(`DRAFT | PLAN_READY | QUEUED | PROCESSING | DONE | FAILED`), `errorMessage?`,
`plan: Json?` (the `AdVideoPlan`), `storageKey?`, `thumbnailKey?`, `srtKey?`,
`videoUrl?`, `durationSec?`, timestamps, `userId` (cascade delete from `User`).

## Queue

`ad-video-render-queue` (`AD_VIDEO_RENDER_QUEUE`), registered in
`queue.module.ts` alongside `video-processing-queue` and
`clip-render-queue`. Job data: `{ adProjectId }`. Consumed by
`AdVideoRenderProcessor` (concurrency 2, 15-minute lock). Counts surfaced via
`/system-status` (`HealthService.getQueueStatus`).

## Frontend

Placeholder route at `/dashboard/ads` (nav entry "Ad Studio") describes the
above as "coming soon" — no new pages/forms have been built against the
`ad-projects` API yet.
