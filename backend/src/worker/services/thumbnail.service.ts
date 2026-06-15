import { Injectable } from '@nestjs/common';
import sharp from 'sharp';

/**
 * Generates social-ready vertical thumbnails by extracting a frame from the
 * rendered clip and overlaying the clip's hook text with a readable
 * gradient + stroke treatment.
 */
@Injectable()
export class ThumbnailService {
  async createThumbnail(framePath: string, hookText: string, outputPath: string): Promise<void> {
    const image = sharp(framePath);
    const metadata = await image.metadata();
    const width = metadata.width ?? 1080;
    const height = metadata.height ?? 1920;

    const svg = this.buildOverlaySvg(width, height, hookText);

    await image
      .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
      .jpeg({ quality: 90 })
      .toFile(outputPath);
  }

  private buildOverlaySvg(width: number, height: number, text: string): string {
    const lines = wrapText(text.toUpperCase(), 18).slice(0, 4);
    const fontSize = Math.round(width * 0.085);
    const lineHeight = Math.round(fontSize * 1.2);
    const startY = Math.round(height * 0.1);
    const strokeWidth = Math.max(2, Math.round(fontSize * 0.06));

    const tspans = lines
      .map((line, i) => `<tspan x="${width / 2}" dy="${i === 0 ? 0 : lineHeight}">${escapeXml(line)}</tspan>`)
      .join('');

    return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="black" stop-opacity="0.6"/>
      <stop offset="0.4" stop-color="black" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#fade)" />
  <text x="${width / 2}" y="${startY}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif"
        font-weight="900" font-size="${fontSize}" fill="#ffffff" stroke="#000000"
        stroke-width="${strokeWidth}" paint-order="stroke" dominant-baseline="hanging">
    ${tspans}
  </text>
</svg>`;
  }
}

function wrapText(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);

  return lines;
}

function escapeXml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
