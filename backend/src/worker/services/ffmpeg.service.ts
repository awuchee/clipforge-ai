import { Injectable } from '@nestjs/common';
import { basename, dirname, join } from 'path';
import { writeFile, unlink } from 'fs/promises';
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

  /** Transcodes an audio file (e.g. Piper's WAV output) to MP3. */
  convertAudioToMp3(input: string, output: string): Promise<void> {
    return new Promise((resolve, reject) => {
      ffmpeg(input)
        .noVideo()
        .audioCodec('libmp3lame')
        .audioBitrate('128k')
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
          "drawtext=text='VixClip AI':fontcolor=white@0.6:fontsize=28:x=w-tw-24:y=h-th-24:box=1:boxcolor=black@0.35:boxborderw=10",
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

  /**
   * Renders one ad scene to a 9:16 (1080x1920) video matching `durationSec`
   * (the synthesized voiceover's duration): either a Ken-Burns-panned product
   * image or a solid color background, with the scene's on-screen text and
   * burned-in ASS captions, muxed with the voiceover audio track.
   */
  renderAdScene(opts: {
    output: string;
    durationSec: number;
    audioPath: string;
    subtitlesPath: string;
    onScreenTextPath: string;
    backgroundImagePath?: string;
    paletteColor: string;
  }): Promise<void> {
    return new Promise((resolve, reject) => {
      const width = 1080;
      const height = 1920;
      const fps = 30;
      const filters: string[] = [];

      let command = ffmpeg();

      if (opts.backgroundImagePath) {
        command = command.input(opts.backgroundImagePath).inputOptions(['-loop', '1']);
        filters.push(`scale=${width}:${height}:force_original_aspect_ratio=increase`);
        filters.push(`crop=${width}:${height}`);
        const totalFrames = Math.max(1, Math.round(opts.durationSec * fps));
        filters.push(`zoompan=z='min(zoom+0.0008,1.1)':d=${totalFrames}:s=${width}x${height}:fps=${fps}`);
      } else {
        command = command.input(`color=c=${opts.paletteColor}:s=${width}x${height}:r=${fps}`).inputOptions(['-f', 'lavfi']);
        filters.push(`fps=${fps}`);
      }

      const textFile = escapeFfmpegFilterPath(opts.onScreenTextPath);
      filters.push(
        `drawtext=textfile='${textFile}':fontcolor=white:fontsize=64:font='Arial':x=(w-text_w)/2:y=h*0.10:line_spacing=14:box=1:boxcolor=black@0.35:boxborderw=24`,
      );

      const subtitles = escapeFfmpegFilterPath(opts.subtitlesPath);
      filters.push(`subtitles='${subtitles}'`);

      command
        .input(opts.audioPath)
        .videoFilters(filters)
        .outputOptions([
          '-t', String(opts.durationSec),
          '-r', String(fps),
          '-pix_fmt', 'yuv420p',
          '-c:v', 'libx264',
          '-preset', 'veryfast',
          '-crf', '23',
          '-c:a', 'aac',
          '-b:a', '128k',
          '-ar', '44100',
          '-ac', '2',
          '-movflags', '+faststart',
          '-shortest',
        ])
        .output(opts.output)
        .on('end', () => resolve())
        .on('error', reject)
        .run();
    });
  }

  /** Concatenates scene videos (same codec/resolution/fps) into a single output via the concat demuxer. */
  async concatVideos(inputs: string[], output: string): Promise<void> {
    const listPath = `${output}.txt`;
    const content = inputs.map((p) => `file '${p.replace(/\\/g, '/').replace(/'/g, "'\\''")}'`).join('\n');
    await writeFile(listPath, content, 'utf-8');

    try {
      await new Promise<void>((resolve, reject) => {
        ffmpeg()
          .input(listPath)
          .inputOptions(['-f', 'concat', '-safe', '0'])
          .outputOptions(['-c', 'copy', '-movflags', '+faststart'])
          .output(output)
          .on('end', () => resolve())
          .on('error', reject)
          .run();
      });
    } finally {
      await unlink(listPath).catch(() => undefined);
    }
  }
}

/** Escapes a filesystem path for use inside an ffmpeg filtergraph string (e.g. `subtitles=`, `drawtext=textfile=`). */
function escapeFfmpegFilterPath(path: string): string {
  return path.replace(/\\/g, '/').replace(/:/g, '\\:').replace(/'/g, "\\'");
}
