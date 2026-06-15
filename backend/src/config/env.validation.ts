/**
 * Startup environment validation, shared by the API process and the worker process.
 *
 * - Required variables missing -> throws, which aborts Nest bootstrap with a clear message.
 * - Optional/degraded-mode variables missing -> logs a warning and the system falls back
 *   to a local/offline mode (local-disk storage, heuristic AI metadata).
 */
export function validateEnv(rawConfig: Record<string, unknown>): Record<string, unknown> {
  const errors: string[] = [];
  const warnings: string[] = [];

  const get = (key: string): string => {
    const value = rawConfig[key];
    return typeof value === 'string' ? value.trim() : '';
  };

  // --- Required: database ---
  if (!get('DATABASE_URL')) {
    errors.push('DATABASE_URL is required (PostgreSQL connection string). See backend/.env.example.');
  }

  // --- Required: Redis (used by both the API producer and the worker consumer) ---
  if (!get('REDIS_URL') && !get('REDIS_HOST')) {
    warnings.push(
      'REDIS_URL / REDIS_HOST not set — defaulting to 127.0.0.1:6379. ' +
        'Set REDIS_URL (e.g. redis://localhost:6379) or REDIS_HOST/REDIS_PORT if Redis runs elsewhere.',
    );
  }

  // --- Optional: S3-compatible storage, falls back to local disk storage ---
  const hasS3Creds = get('S3_ACCESS_KEY_ID') && get('S3_SECRET_ACCESS_KEY') && get('S3_BUCKET');
  const storageDriver = get('STORAGE_DRIVER') || (hasS3Creds ? 's3' : 'local');
  if (storageDriver === 's3' && !hasS3Creds) {
    errors.push(
      'STORAGE_DRIVER=s3 but S3_BUCKET/S3_ACCESS_KEY_ID/S3_SECRET_ACCESS_KEY are not fully set. ' +
        'Either provide S3 credentials or remove STORAGE_DRIVER to use local disk storage.',
    );
  } else if (storageDriver === 'local') {
    warnings.push(
      'S3 credentials not configured — using local disk storage (STORAGE_DRIVER=local). ' +
        'Uploaded files and rendered clips are served from the API at /files/<key>. ' +
        'Set S3_BUCKET/S3_ACCESS_KEY_ID/S3_SECRET_ACCESS_KEY to use real S3/R2 storage.',
    );
  }

  // --- Optional: OpenAI ---
  // Note: viral-metadata generation falls back to offline heuristics when this is unset,
  // but transcription (Whisper) has no offline fallback and is REQUIRED for video processing.
  if (!get('OPENAI_API_KEY')) {
    warnings.push(
      'OPENAI_API_KEY not set — viral-metadata generation will use offline fallback heuristics, ' +
        'but Whisper transcription has no offline fallback: video processing jobs will fail until ' +
        'OPENAI_API_KEY is configured.',
    );
  }

  // --- Optional: Stripe billing ---
  // Without these, all accounts behave as FREE plan and /billing/checkout,
  // /billing/portal, and /billing/webhook return errors instead of crashing.
  const hasStripeKey = get('STRIPE_SECRET_KEY');
  if (!hasStripeKey || !get('STRIPE_PRICE_PRO_ID') || !get('STRIPE_WEBHOOK_SECRET')) {
    warnings.push(
      'Stripe billing is not fully configured (STRIPE_SECRET_KEY / STRIPE_PRICE_PRO_ID / ' +
        'STRIPE_WEBHOOK_SECRET) — Pro upgrades are unavailable and all accounts remain on the FREE plan.',
    );
  }

  if (errors.length > 0) {
    const message =
      '\n\nClipForge configuration error — fix backend/.env before starting:\n' +
      errors.map((e) => `  ✗ ${e}`).join('\n') +
      '\n\nSee backend/.env.example for the full list of variables.\n';
    throw new Error(message);
  }

  for (const warning of warnings) {
    // eslint-disable-next-line no-console
    console.warn(`[ClipForge config] WARNING: ${warning}`);
  }

  return rawConfig;
}
