import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { createWriteStream } from 'fs';
import { mkdir, copyFile, rm, writeFile } from 'fs/promises';
import { dirname, join } from 'path';
import { pipeline } from 'stream/promises';
import type { Readable } from 'stream';

export type StorageDriver = 's3' | 'local';

/**
 * Resolves the active storage driver the same way env.validation.ts does:
 * explicit STORAGE_DRIVER wins, otherwise fall back to 's3' only if full
 * S3 credentials are present, else 'local'.
 */
export function resolveStorageDriver(config: ConfigService): StorageDriver {
  const explicit = config.get<string>('STORAGE_DRIVER');
  if (explicit === 's3' || explicit === 'local') return explicit;

  const hasS3Creds =
    !!config.get<string>('S3_ACCESS_KEY_ID') &&
    !!config.get<string>('S3_SECRET_ACCESS_KEY') &&
    !!config.get<string>('S3_BUCKET');

  return hasS3Creds ? 's3' : 'local';
}

@Injectable()
export class StorageService {
  private readonly logger = new Logger('Storage');
  private readonly driver: StorageDriver;
  private readonly client?: S3Client;
  private readonly bucket: string;
  private readonly publicUrl: string;
  private readonly localDir: string;
  private readonly apiBaseUrl: string;

  constructor(private config: ConfigService) {
    this.driver = resolveStorageDriver(this.config);
    this.bucket = this.config.get<string>('S3_BUCKET', '');
    this.publicUrl = this.config.get<string>('S3_PUBLIC_URL', '');
    this.localDir = this.config.get<string>('STORAGE_LOCAL_DIR') || join(process.cwd(), 'storage-data');

    const port = this.config.get<number>('PORT', 4000);
    this.apiBaseUrl = this.config.get<string>('API_BASE_URL', `http://localhost:${port}`);

    if (this.driver === 's3') {
      this.client = new S3Client({
        region: this.config.get<string>('S3_REGION', 'auto'),
        endpoint: this.config.get<string>('S3_ENDPOINT') || undefined,
        forcePathStyle: true,
        credentials: {
          accessKeyId: this.config.get<string>('S3_ACCESS_KEY_ID', ''),
          secretAccessKey: this.config.get<string>('S3_SECRET_ACCESS_KEY', ''),
        },
      });
      this.logger.log('Using S3-compatible storage driver');
    } else {
      this.logger.log(`Using local disk storage driver (${this.localDir})`);
    }
  }

  private localPath(key: string): string {
    return join(this.localDir, key);
  }

  async uploadFile(key: string, body: Buffer, contentType: string): Promise<string> {
    if (this.driver === 'local') {
      const dest = this.localPath(key);
      await mkdir(dirname(dest), { recursive: true });
      await writeFile(dest, body);
      return this.getPublicUrl(key);
    }

    await this.client!.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );

    return this.getPublicUrl(key);
  }

  async uploadLocalFile(key: string, localPath: string, contentType: string): Promise<string> {
    if (this.driver === 'local') {
      const dest = this.localPath(key);
      await mkdir(dirname(dest), { recursive: true });
      await copyFile(localPath, dest);
      return this.getPublicUrl(key);
    }

    const { createReadStream } = await import('fs');
    const { stat } = await import('fs/promises');
    const { size } = await stat(localPath);

    await this.client!.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: createReadStream(localPath),
        ContentType: contentType,
        ContentLength: size,
      }),
    );

    return this.getPublicUrl(key);
  }

  async downloadToFile(key: string, destPath: string): Promise<void> {
    if (this.driver === 'local') {
      await copyFile(this.localPath(key), destPath);
      return;
    }

    const result = await this.client!.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));

    if (!result.Body) {
      throw new Error(`No body returned for storage key: ${key}`);
    }

    await pipeline(result.Body as Readable, createWriteStream(destPath));
  }

  /** Deletes one or more objects (e.g. cleaning up a clip rejected by the quality filter). */
  async deleteFiles(keys: string[]): Promise<void> {
    const validKeys = keys.filter((key): key is string => !!key);

    if (this.driver === 'local') {
      await Promise.all(
        validKeys.map((key) => rm(this.localPath(key), { force: true }).catch(() => undefined)),
      );
      return;
    }

    await Promise.all(
      validKeys.map((key) => this.client!.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }))),
    );
  }

  getPublicUrl(key: string): string {
    if (this.driver === 'local') {
      return `${this.apiBaseUrl.replace(/\/$/, '')}/files/${key}`;
    }

    if (this.publicUrl) {
      return `${this.publicUrl.replace(/\/$/, '')}/${key}`;
    }

    const endpoint = this.config.get<string>('S3_ENDPOINT', '').replace(/\/$/, '');
    return `${endpoint}/${this.bucket}/${key}`;
  }
}
