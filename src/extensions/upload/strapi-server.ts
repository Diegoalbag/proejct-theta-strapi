/**
 * Phase 11 Plan 01 — WebP format conversion via Strapi's documented
 * plugin-extension mechanism (D-03).
 *
 * https://docs.strapi.io/cms/plugins-development/plugins-extension
 *
 * Strapi's stock Upload plugin resizes images but always re-encodes to the
 * SAME original format — a PNG/JPEG hero image never gets a smaller WebP
 * alternative without this extension (verified directly against
 * `node_modules/@strapi/upload`'s own source — no `.toFormat()` call anywhere
 * in its pipeline).
 *
 * This override captures the ORIGINAL `generateResponsiveFormats` (before
 * reassignment) so the existing thumbnail/small/medium/large resize behavior
 * is preserved byte-for-byte; it only appends a new `webp` array entry.
 *
 * T-11-01 (Tampering / Denial of Service): the whole WebP branch is wrapped in
 * try/catch — on ANY error (corrupt/malformed image, sharp throwing) it logs
 * and returns the ORIGINAL resize-only `formats` array unchanged. A bad image
 * file must never break the surrounding upload request.
 */

import sharp from "sharp";
import { buildWebpFormatEntry } from "./webp-format";

// Strapi injects a global `strapi` instance at runtime for plugin-extension
// modules (this project doesn't ambient-declare it elsewhere — everywhere
// else in the codebase threads `strapi` explicitly as a parameter instead).
declare const strapi: { log: { warn: (...args: unknown[]) => void; error: (...args: unknown[]) => void } };

interface ImageManipulationFile {
  name: string;
  hash: string;
  width?: number;
  height?: number;
  filepath?: string;
}

interface ResponsiveFormatEntry {
  key: string;
  file: unknown;
}

export default (plugin: any) => {
  const imageManipulationService = plugin.services["image-manipulation"];
  const originalGenerateResponsiveFormats: (
    file: ImageManipulationFile,
  ) => Promise<ResponsiveFormatEntry[]> = imageManipulationService.generateResponsiveFormats;

  imageManipulationService.generateResponsiveFormats = async (
    file: ImageManipulationFile,
  ): Promise<ResponsiveFormatEntry[]> => {
    // (1) Preserve the existing thumbnail/small/medium/large resize behavior
    // UNCHANGED — this is the base `formats` array.
    const formats = await originalGenerateResponsiveFormats(file);

    // (2) Attempt to append a WebP sibling format.
    if (!file.filepath) {
      // (3) No local temp file (non-local-provider upload flow) — skip WebP
      // generation for this file rather than attempting a stream-to-buffer
      // conversion.
      strapi.log.warn("[webp-format] skipped — no filepath");
      return formats;
    }

    try {
      const webpBuffer = await sharp(file.filepath).webp({ quality: 80 }).toBuffer();
      const webpEntry = buildWebpFormatEntry(
        { name: file.name, hash: file.hash, width: file.width, height: file.height },
        webpBuffer,
      );
      return [...formats, { key: "webp", file: webpEntry }];
    } catch (err) {
      // (4) A WebP conversion failure must never break the rest of the
      // upload — degrade to the original resize-only formats array.
      strapi.log.error(
        "[webp-format] conversion failed, continuing without webp variant",
        err,
      );
      return formats;
    }
  };

  return plugin;
};
