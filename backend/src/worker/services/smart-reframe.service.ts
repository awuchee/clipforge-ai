import { Injectable, Logger } from '@nestjs/common';
import { mkdir, readdir, rm } from 'fs/promises';
import { join } from 'path';
import sharp from 'sharp';
import { FfmpegService, CropPlan } from './ffmpeg.service';

const SAMPLE_FPS = 1 / 0.75; // one analysis frame every ~0.75s
const ANALYSIS_WIDTH = 64;
/** Max horizontal pan speed in source pixels/sec - keeps movement smooth. */
const MAX_PAN_PER_SEC = 220;
/** How quickly the focus point chases a new target (0-1, higher = snappier). */
const SMOOTHING_ALPHA = 0.25;
/** Average per-pixel luma delta below this is treated as "no significant motion". */
const MOTION_THRESHOLD = 6;

/**
 * Computes a dynamic 9:16 crop path that pans across the source frame to keep
 * the most "active" region (the speaker who is currently moving/gesturing)
 * centered, instead of a fixed center-crop. Uses frame-differencing motion
 * analysis as a lightweight, dependency-free proxy for active-speaker
 * tracking, with exponential smoothing and a max-pan-rate clamp so the camera
 * never jumps or jitters.
 *
 * Designed so a real face-detection model could later replace
 * `findMotionFocus` without touching the smoothing/crop-path pipeline.
 */
@Injectable()
export class SmartReframeService {
  private readonly logger = new Logger(SmartReframeService.name);

  constructor(private ffmpeg: FfmpegService) {}

  async computeCropPlan(
    sourcePath: string,
    startSec: number,
    durationSec: number,
    sourceWidth: number,
    sourceHeight: number,
    workDir: string,
  ): Promise<CropPlan | null> {
    const cropW = Math.min(sourceWidth, Math.round((sourceHeight * 9) / 16));
    const cropH = sourceHeight;

    if (cropW >= sourceWidth) {
      // Source is already at or narrower than 9:16 - no horizontal room to pan.
      return null;
    }

    const framesDir = join(workDir, 'reframe-frames');

    try {
      await mkdir(framesDir, { recursive: true });
      await this.ffmpeg.extractSampledFrames(sourcePath, startSec, durationSec, SAMPLE_FPS, framesDir);

      const files = (await readdir(framesDir)).filter((f) => f.endsWith('.jpg')).sort();
      if (files.length < 2) return null;

      const maxX = sourceWidth - cropW;
      const positions: { t: number; x: number }[] = [];
      let prevData: Buffer | null = null;
      let currentX = maxX / 2;

      for (let i = 0; i < files.length; i++) {
        const t = i / SAMPLE_FPS;
        const { data, info } = await sharp(join(framesDir, files[i]))
          .resize({ width: ANALYSIS_WIDTH })
          .greyscale()
          .raw()
          .toBuffer({ resolveWithObject: true });

        if (prevData) {
          const focusRatio = this.findMotionFocus(prevData, data, info.width, info.height);
          if (focusRatio !== null) {
            const target = Math.max(0, Math.min(maxX, focusRatio * sourceWidth - cropW / 2));
            currentX += (target - currentX) * SMOOTHING_ALPHA;
          }
        }

        positions.push({ t, x: Math.max(0, Math.min(maxX, currentX)) });
        prevData = data;
      }

      this.clampPanRate(positions);

      if (positions.every((p) => Math.abs(p.x - positions[0].x) < 1)) {
        // No meaningful movement detected - a static center crop is equivalent and simpler.
        return null;
      }

      return { width: cropW, height: cropH, xExpr: this.buildExpression(positions, maxX) };
    } catch (err) {
      this.logger.warn(`Smart reframe analysis failed, falling back to center crop: ${(err as Error).message}`);
      return null;
    } finally {
      await rm(framesDir, { recursive: true, force: true }).catch(() => undefined);
    }
  }

  /** Returns the horizontal position (0-1) of the highest-motion region, or null if motion is negligible. */
  private findMotionFocus(prev: Buffer, curr: Buffer, width: number, height: number): number | null {
    const columnEnergy = new Float64Array(width);
    let total = 0;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        const diff = Math.abs(curr[idx] - prev[idx]);
        columnEnergy[x] += diff;
        total += diff;
      }
    }

    if (total / (width * height) < MOTION_THRESHOLD) {
      return null;
    }

    let weightedSum = 0;
    for (let x = 0; x < width; x++) {
      weightedSum += columnEnergy[x] * (x + 0.5);
    }

    return weightedSum / total / width;
  }

  /** Limits how fast the crop window can move between samples, preventing sudden jumps. */
  private clampPanRate(positions: { t: number; x: number }[]): void {
    for (let i = 1; i < positions.length; i++) {
      const dt = positions[i].t - positions[i - 1].t;
      const maxDelta = MAX_PAN_PER_SEC * dt;
      const delta = positions[i].x - positions[i - 1].x;
      if (Math.abs(delta) > maxDelta) {
        positions[i].x = positions[i - 1].x + Math.sign(delta) * maxDelta;
      }
    }
  }

  /** Builds an ffmpeg expression that piecewise-linearly interpolates `x` over time `t`, clamped to [0, maxX]. */
  private buildExpression(positions: { t: number; x: number }[], maxX: number): string {
    if (positions.length === 1) {
      return Math.round(positions[0].x).toString();
    }

    let expr = positions[positions.length - 1].x.toFixed(1);
    for (let i = positions.length - 2; i >= 0; i--) {
      const a = positions[i];
      const b = positions[i + 1];
      const span = b.t - a.t || 1;
      const interp = `${a.x.toFixed(1)}+(${(b.x - a.x).toFixed(1)})*((t-${a.t.toFixed(2)})/${span.toFixed(2)})`;
      expr = `if(lt(t\\,${b.t.toFixed(2)})\\,${interp}\\,${expr})`;
    }

    return `clip(${expr}\\,0\\,${maxX})`;
  }
}
