import { Controller, Get, NotFoundException, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { createReadStream, existsSync, statSync } from 'fs';
import { extname, join, normalize, resolve, sep } from 'path';

const MIME_TYPES: Record<string, string> = {
  '.mp4': 'video/mp4',
  '.mov': 'video/quicktime',
  '.webm': 'video/webm',
  '.m4a': 'audio/mp4',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.srt': 'text/plain',
  '.vtt': 'text/vtt',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
};

/**
 * Serves files from local disk storage when STORAGE_DRIVER=local.
 * Only reachable at /files/* (excluded from the /api prefix).
 */
@Controller('files')
export class FilesController {
  private readonly rootDir: string;

  constructor(config: ConfigService) {
    this.rootDir = resolve(config.get<string>('STORAGE_LOCAL_DIR') || join(process.cwd(), 'storage-data'));
  }

  @Get('*')
  serve(@Req() req: Request, @Res() res: Response) {
    const key = req.params[0];
    const safePath = normalize(join(this.rootDir, key));

    if (!safePath.startsWith(this.rootDir + sep) && safePath !== this.rootDir) {
      throw new NotFoundException('File not found');
    }

    if (!existsSync(safePath) || !statSync(safePath).isFile()) {
      throw new NotFoundException('File not found');
    }

    const contentType = MIME_TYPES[extname(safePath).toLowerCase()] ?? 'application/octet-stream';
    res.setHeader('Content-Type', contentType);
    createReadStream(safePath).pipe(res);
  }
}
