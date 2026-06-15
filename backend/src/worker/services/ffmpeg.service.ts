import { Injectable } from '@nestjs/common';
import { basename, dirname, join } from 'path';
import ffmpeg from 'fluent-ffmpeg';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const ffmpegPath = require('ffmpeg-static') as string;
// eslint-disable-next-line @typescript-eslint/no-var-requires
const ffprobePath = (require('@ffprobe-installer/ffprobe') as { path: string }).path;

ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);

export interface CropPlan {
  width: number;
  height: number;
  /** ffmpeg crop x-position expression (may reference `t`), commas pre-escaped. */
  xExpr: string;
}

@Injectable()
export class FfmpegService {
  probeDuration(filePath: string): Promise<number> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(filePath, (err, data) => {
        if (err) return reject(err);
        resolve(data.format.duration ?? 0);
      });
    });
  }

  probeDimensions(filePath: string): Promise<{ width: number; height: number }> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(filePath, (err, data) => {
        if (err) return reject(err);
        const videoStream = data.streams.find((s) => s.codec_type === 'video');
        resolve({ width: videoStream?.width ?? 1920, height: videoStream?.height ?? 1080 });
      });
    });
  }

  extractAudio(input: string, output: string): Promise<void> {
    return new Promise((resolve, reject) => {
      ffmpeg(input)
        .noVideo()
        .audioCodec('libmp3lame')
        .audioBitrate('64k')
        .audioChannels(1)
        .output(output)
        .on('end', () => resolve())
        .on('error', reject)
        .run();
    });
  }

  /**
   * Extracts sampled frames at `fps` from [startSec, startSec + durationSec)
   * for motion analysis (used by SmartReframeService).
   */
  extractSampledFrames(input: string, startSec: number, durationSec: number, fps: number, outDir: string): Promise<void> {
    return new Promise((resolve, reject) => {
      ffmpeg(input)
        .setStartTime(startSec)
        .setDuration(durationSec)
        .outputOptions(['-vf', `fps=${fps}`, '-q:v', '5'])
        .output(join(outDir, 'frame-%04d.jpg'))
        .on('end', () => resolve())
        .on('error', reject)
        .run();
    });
  }

  /**
   * Cuts [startSec, startSec + durationSec) from `input`, reframes it to a
   * 9:16 vertical (1080x1920) crop (static center-crop, or a dynamic
   * `cropPlan` that pans to track the active speaker), and optionally burns
   * in an ASS subtitle track.
   */
  renderClip(
    input: string,
    output: string,
    startSec: number,
    durationSec: number,
    subtitlesPath?: string,
    cropPlan?: CropPlan,
    watermark?: boolean,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const filters = cropPlan
        ? [`crop=${cropPlan.width}:${cropPlan.height}:${cropPlan.xExpr}:0`]
        : ["crop='min(in_w,in_h*9/16)':'min(in_h,in_w*16/9)'"];

      filters.push('scale=1080:1920');

      if (subtitlesPath) {
        const escaped = subtitlesPath.replace(/\\/g, '/').replace(/:/g, '\\:').replace(/'/g, "\\'");
        filters.push(`subtitles='${escaped}'`);
      }

      if (watermark) {
        filters.push(
          "drawtext=text='ClipForge AI':fontcolor=white@0.6:fontsize=28:x=w-tw-24:y=h-th-24:box=1:boxcolor=black@0.35:boxborderw=10",
        );
      }

      ffmpeg(input)
        .setStartTime(startSec)
        .setDuration(durationSec)
        .videoFilters(filters)
        .videoCodec('libx264')
        .outputOptions(['-preset', 'veryfast', '-crf', '23', '-movflags', '+faststart', '-pix_fmt', 'yuv420p'])
        .audioCodec('aac')
        .audioBitrate('128k')
        .output(output)
        .on('end', () => resolve())
        .on('error', reject)
        .run();
    });
  }

  generateThumbnail(clipPath: string, output: string, atSec = 0.5): Promise<void> {
    return new Promise((resolve, reject) => {
      ffmpeg(clipPath)
        .screenshots({
          timestamps: [atSec],
          filename: basename(output),
          folder: dirname(output),
        })
        .on('end', () => resolve())
        .on('error', reject);
    });
  }
}
