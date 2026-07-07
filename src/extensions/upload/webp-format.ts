/**
 * Phase 11 Plan 01 — pure WebP format-object builder (D-03).
 *
 * Strapi's stock Upload plugin resizes images but always re-encodes to the
 * SAME original format (verified directly against
 * `node_modules/@strapi/upload`'s `image-manipulation.js::resizeFileTo` this
 * planning session — there is no `.toFormat()` call anywhere in its pipeline).
 * This module builds a format-object entry, MODELED EXACTLY on `resizeFileTo`'s
 * return shape, so `uploadResponsiveFormat()` in `upload.js` can upload and
 * persist it onto `file.formats.webp` exactly like a real breakpoint format.
 *
 * This function is fully pure and side-effect-free (no fs, no sharp, no
 * network) — the actual sharp-based WebP conversion happens in
 * `strapi-server.ts` (Task 3), which then calls this builder with the
 * resulting buffer.
 */

import { Readable } from "node:stream";

export interface WebpSourceFile {
  name: string;
  hash: string;
  width?: number;
  height?: number;
}

export interface UploadFormatFile {
  name: string;
  hash: string;
  ext: string;
  mime: string;
  width?: number;
  height?: number;
  size: number;
  sizeInBytes: number;
  path: string | null;
  getStream: () => NodeJS.ReadableStream;
}

/** Replace a trailing extension with `.webp`, or append `.webp` when absent. */
function toWebpName(name: string): string {
  const lastDot = name.lastIndexOf(".");
  const base = lastDot > 0 ? name.slice(0, lastDot) : name;
  return `${base}.webp`;
}

/**
 * Builds an `UploadFormatFile` for a WebP-encoded buffer, mirroring the shape
 * `resizeFileTo` returns in `@strapi/upload`'s `image-manipulation.js`
 * (name, hash, ext, mime, width, height, size, sizeInBytes, path, getStream).
 */
export function buildWebpFormatEntry(
  source: WebpSourceFile,
  webpBuffer: Buffer,
): UploadFormatFile {
  return {
    name: toWebpName(source.name),
    hash: `${source.hash}_webp`,
    ext: ".webp",
    mime: "image/webp",
    width: source.width,
    height: source.height,
    size: Math.round((webpBuffer.length / 1024) * 100) / 100,
    sizeInBytes: webpBuffer.length,
    path: null,
    getStream: () => Readable.from(webpBuffer),
  };
}
