import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';
import { FfmpegService } from './ffmpeg.service';

/** Maps the plan's `audioDirection.voiceGenderSuggestion` to a bundled Piper voice model. */
const VOICE_MODEL_BY_GENDER: Record<string, string> = {
  male: 'en_US-ryan-medium.onnx',
  female: 'en_US-amy-medium.onnx',
  either: 'en_US-amy-medium.onnx',
  neutral: 'en_US-amy-medium.onnx',
};

/**
 * Local, offline text-to-speech via Piper (https://github.com/rhasspy/piper).
 * Used as a zero-cost fallback for `TextToSpeechService` when `OPENAI_API_KEY`
 * is not configured. Requires the `piper` executable and `.onnx` voice models
 * to be present (see `backend/scripts/setup-piper.*` and `PIPER_*` env vars).
 */
@Injectable()
export class PiperTtsService {
  private readonly logger = new Logger(PiperTtsService.name);
  private readonly executablePath: string;
  private readonly voicesDir: string;

  constructor(
    private config: ConfigService,
    private ffmpeg: FfmpegService,
  ) {
    const defaultExecutable = process.platform === 'win32' ? 'piper.exe' : 'piper';
    this.executablePath =
      this.config.get<string>('PIPER_EXECUTABLE_PATH') || join(__dirname, '../../../bin/piper', defaultExecutable);
    this.voicesDir = this.config.get<string>('PIPER_VOICES_DIR') || join(__dirname, '../../../bin/piper/voices');
  }

  /** Whether the Piper binary and at least the default voice model are present on disk. */
  isAvailable(): boolean {
    return existsSync(this.executablePath) && existsSync(join(this.voicesDir, 'en_US-amy-medium.onnx'));
  }

  /** Synthesizes `text` to an MP3 file at `outputPath` using a local Piper voice model. */
  async synthesize(text: string, voiceGenderSuggestion: string, outputPath: string): Promise<void> {
    const modelFile = VOICE_MODEL_BY_GENDER[voiceGenderSuggestion?.toLowerCase()?.trim()] ?? 'en_US-amy-medium.onnx';
    const modelPath = join(this.voicesDir, modelFile);

    if (!existsSync(this.executablePath)) {
      throw new Error(`Piper executable not found at ${this.executablePath}. Run backend/scripts/setup-piper.`);
    }
    if (!existsSync(modelPath)) {
      throw new Error(`Piper voice model not found at ${modelPath}. Run backend/scripts/setup-piper.`);
    }

    const wavPath = `${outputPath}.piper.wav`;
    await this.runPiper(text, modelPath, wavPath);
    await this.ffmpeg.convertAudioToMp3(wavPath, outputPath);
  }

  private runPiper(text: string, modelPath: string, wavOutputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const proc = spawn(this.executablePath, ['--model', modelPath, '--output_file', wavOutputPath], {
        cwd: dirnameSafe(this.executablePath),
      });

      let stderr = '';
      proc.stderr.on('data', (chunk) => {
        stderr += chunk.toString();
      });

      proc.on('error', reject);
      proc.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          this.logger.error(`Piper exited with code ${code}: ${stderr.trim()}`);
          reject(new Error(`Piper TTS failed with exit code ${code}`));
        }
      });

      proc.stdin.write(text);
      proc.stdin.end();
    });
  }
}

function dirnameSafe(filePath: string): string {
  const idx = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'));
  return idx >= 0 ? filePath.slice(0, idx) : '.';
}
