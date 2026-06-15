import { Injectable, Logger } from '@nestjs/common';
import { dirname } from 'path';
import { StorageService } from '../../storage/storage.service';
import { SourceType } from '@prisma/client';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const ytdlp = require('yt-dlp-exec') as (url: string, opts: Record<string, unknown>) => Promise<unknown>;
// eslint-disable-next-line @typescript-eslint/no-var-requires
const ffmpegPath = require('ffmpeg-static') as string;

const MAX_DOWNLOAD_ATTEMPTS = 3;
const RETRY_DELAY_MS = 2000;

/** Error messages from yt-dlp that indicate a permanent failure (retrying won't help). */
const PERMANENT_ERROR_PATTERNS: Array<{ pattern: RegExp; message: string }> = [
  { pattern: /private video/i, message: 'This YouTube video is private and cannot be imported.' },
  { pattern: /video unavailable/i, message: 'This YouTube video is unavailable. It may have been removed or made private.' },
  { pattern: /sign in to confirm your age|age[- ]restricted/i, message: 'This YouTube video is age-restricted and cannot be imported.' },
  { pattern: /this live event (has ended|will begin)/i, message: 'This YouTube live stream is not available for import.' },
  { pattern: /members-only/i, message: 'This YouTube video is members-only and cannot be imported.' },
  { pattern: /copyright/i, message: 'This YouTube video is unavailable due to a copyright claim.' },
  { pattern: /unsupported url|is not a valid url|no video formats found/i, message: 'The provided URL is not a supported YouTube video.' },
  { pattern: /this video is not available/i, message: 'This YouTube video is not available in this context.' },
];

@Injectable()
export class SourceService {
  private readonly logger = new Logger(SourceService.name);

  constructor(private storage: StorageService) {}

  /** Downloads a project's source media to `destPath` on local disk. */
  async fetchSource(
    params: { sourceType: SourceType; sourceUrl: string | null; storageKey: string | null },
    destPath: string,
  ): Promise<void> {
    if (params.sourceType === SourceType.YOUTUBE) {
      if (!params.sourceUrl) {
        throw new Error('Project is missing a YouTube source URL');
      }
      await this.downloadYoutube(params.sourceUrl, destPath);
      return;
    }

    if (!params.storageKey) {
      throw new Error('Project is missing a storage key for its source file');
    }
    await this.storage.downloadToFile(params.storageKey, destPath);
  }

  private async downloadYoutube(url: string, destPath: string): Promise<void> {
    let lastError: Error = new Error('Unknown error');

    for (let attempt = 1; attempt <= MAX_DOWNLOAD_ATTEMPTS; attempt++) {
      try {
        await ytdlp(url, {
          output: destPath,
          format: 'bv*[ext=mp4]+ba[ext=m4a]/b[ext=mp4]/b',
          mergeOutputFormat: 'mp4',
          ffmpegLocation: dirname(ffmpegPath),
          noPlaylist: true,
          noWarnings: true,
          noCheckCertificates: true,
          retries: 2,
        });
        return;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const permanent = PERMANENT_ERROR_PATTERNS.find((p) => p.pattern.test(message));
        if (permanent) {
          throw new Error(permanent.message);
        }

        lastError = err instanceof Error ? err : new Error(message);
        this.logger.warn(
          `YouTube download attempt ${attempt}/${MAX_DOWNLOAD_ATTEMPTS} failed: ${message.slice(0, 300)}`,
        );

        if (attempt < MAX_DOWNLOAD_ATTEMPTS) {
          await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS * attempt));
        }
      }
    }

    throw new Error(
      `Failed to download YouTube video after ${MAX_DOWNLOAD_ATTEMPTS} attempts: ${lastError.message.slice(0, 300)}`,
    );
  }
}
