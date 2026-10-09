/**
 * Image checks (Artwork Manager): is this byte content a complete PNG or JPEG of a sensible size?
 * Pure: works on bytes only. Nothing downloaded is ever executed or interpreted beyond this.
 */
import type { ImageExtension } from './manifest';

/** Larger files are rejected (official card images are ~0.1–1 MB). */
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MIN_IMAGE_BYTES = 64;

export type ImageCheck =
  | {
      readonly ok: true;
      readonly ext: ImageExtension;
      readonly width: number;
      readonly height: number;
    }
  | { readonly ok: false; readonly reason: string };

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

const startsWith = (b: Uint8Array, sig: readonly number[]) => sig.every((x, i) => b[i] === x);
const u32 = (b: Uint8Array, at: number) =>
  ((b[at]! << 24) | (b[at + 1]! << 16) | (b[at + 2]! << 8) | b[at + 3]!) >>> 0;
const u16 = (b: Uint8Array, at: number) => (b[at]! << 8) | b[at + 1]!;

/** Width and height from a JPEG's first start-of-frame marker, or null. */
function jpegSize(b: Uint8Array): { width: number; height: number } | null {
  let i = 2;
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) return null;
    const marker = b[i + 1]!;
    if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
      i += 2;
      continue;
    }
    const length = u16(b, i + 2);
    // SOF0–SOF15, except DHT (C4), JPG (C8) and DAC (CC)
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      return { height: u16(b, i + 5), width: u16(b, i + 7) };
    }
    i += 2 + length;
  }
  return null;
}

/**
 * Checks the content (not the file name): the PNG or JPEG signature, its dimensions, and that the
 * file is complete (PNG ends with an IEND chunk, JPEG with an end-of-image marker), so a download
 * cut short is never accepted.
 */
export function checkImage(bytes: Uint8Array): ImageCheck {
  if (bytes.length < MIN_IMAGE_BYTES) return { ok: false, reason: 'too small to be an image' };
  if (bytes.length > MAX_IMAGE_BYTES) return { ok: false, reason: 'larger than 10 MB' };
  if (startsWith(bytes, PNG_SIGNATURE)) {
    const ihdr = String.fromCharCode(...bytes.subarray(12, 16));
    if (ihdr !== 'IHDR') return { ok: false, reason: 'damaged PNG (no header chunk)' };
    const end = String.fromCharCode(...bytes.subarray(bytes.length - 8, bytes.length - 4));
    if (end !== 'IEND') return { ok: false, reason: 'incomplete PNG (no end chunk)' };
    const width = u32(bytes, 16);
    const height = u32(bytes, 20);
    if (width === 0 || height === 0) return { ok: false, reason: 'PNG with no size' };
    return { ok: true, ext: 'png', width, height };
  }
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    if (bytes[bytes.length - 2] !== 0xff || bytes[bytes.length - 1] !== 0xd9) {
      return { ok: false, reason: 'incomplete JPEG (no end marker)' };
    }
    const size = jpegSize(bytes);
    if (!size || size.width === 0 || size.height === 0) {
      return { ok: false, reason: 'damaged JPEG (no frame header)' };
    }
    return { ok: true, ext: 'jpg', ...size };
  }
  return { ok: false, reason: 'not a PNG or JPEG image' };
}
