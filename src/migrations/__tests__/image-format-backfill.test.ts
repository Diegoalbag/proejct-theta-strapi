import { describe, expect, it } from "vitest";
// RED (Phase 11, Plan 07): `../image-format-backfill` is built in this plan's
// GREEN step (D-02, D-03). This suite MUST fail now (module absent) so the
// idempotent per-tenant backfill migration has an automated gate BEFORE the
// implementation lands — mirrors the theme-scope.ts RED/GREEN precedent.
//
// Contract under test:
//   runImageFormatBackfill(strapi):
//     - every file already has formats.webp -> { skipped: true }, zero update calls
//     - mixed files -> update ONLY files missing formats.webp, merging (never
//       clobbering) their existing formats
//     - one file's conversion throwing -> every OTHER file still gets migrated,
//       the function itself never throws
//     - DB-backed upload settings (responsiveDimensions/sizeOptimization/
//       autoOrientation) are enabled BEFORE processing files, merged over
//       whatever getSettings() already returned — even in the skipped case
//     - the function never throws even when getSettings/setSettings/findMany
//       itself rejects; it returns {} (outer try/catch)
import { runImageFormatBackfill } from "../image-format-backfill";
import {
  filesAllConverted,
  filesNeedingBackfill,
  makeUploadStrapiMock,
} from "../__fixtures__/image-format-backfill.fixtures";

describe("runImageFormatBackfill — idempotent WebP backfill + settings enablement (D-02, D-03)", () => {
  it("Test 1: is idempotent — when every file already has formats.webp, returns { skipped: true } and issues ZERO update calls", async () => {
    const { strapi, spies } = makeUploadStrapiMock({ files: filesAllConverted });

    const result = await runImageFormatBackfill(strapi as never);

    expect(result).toMatchObject({ skipped: true });
    expect(spies.update).not.toHaveBeenCalled();
  });

  it("Test 2: on a mix of files, calls update ONLY for files missing formats.webp, merging (never clobbering) their existing formats", async () => {
    const { strapi, spies } = makeUploadStrapiMock({ files: filesNeedingBackfill });

    const result = await runImageFormatBackfill(strapi as never);

    expect(result).toMatchObject({ migrated: true, count: 2 });
    // only ids 10 and 12 (missing webp) get updated — id 11 already has webp
    expect(spies.update).toHaveBeenCalledTimes(2);
    const updatedIds = spies.update.mock.calls.map((call: any) => call[0]?.where?.id).sort();
    expect(updatedIds).toEqual([10, 12]);

    const call10 = spies.update.mock.calls.find((call: any) => call[0]?.where?.id === 10);
    expect(call10?.[0]?.data?.formats).toMatchObject({
      thumbnail: { url: "/uploads/thumbnail_hero.png" },
      small: { url: "/uploads/small_hero.png" },
      webp: { url: "/uploads/hero_ghi789.webp" },
    });

    const call12 = spies.update.mock.calls.find((call: any) => call[0]?.where?.id === 12);
    expect(call12?.[0]?.data?.formats).toMatchObject({
      thumbnail: { url: "/uploads/thumbnail_banner.jpg" },
      medium: { url: "/uploads/medium_banner.jpg" },
      large: { url: "/uploads/large_banner.jpg" },
      webp: { url: "/uploads/banner_mno345.webp" },
    });
  });

  it("Test 3: one file's conversion throwing never blocks the rest of the batch and the function itself does not throw", async () => {
    const { strapi, spies } = makeUploadStrapiMock({
      files: filesNeedingBackfill,
      generateResponsiveFormatsImpl: async (file) => {
        if (file.id === 10) {
          throw new Error("corrupt/unreadable image");
        }
        return [{ key: "webp", file: { url: `/uploads/${file.hash}.webp` } }];
      },
    });

    // Awaiting directly (rather than wrapping in expect(...).not.toThrow())
    // proves the function itself never throws: an uncaught rejection here
    // would fail the test just as surely, and this way `result` is populated.
    const result = await runImageFormatBackfill(strapi as never);

    expect(result).toMatchObject({ migrated: true, count: 1 });
    // only id 12 (the non-throwing file missing webp) was actually updated
    expect(spies.update).toHaveBeenCalledTimes(1);
    expect(spies.update.mock.calls[0][0]?.where?.id).toBe(12);
  });

  it("Test 4: enables DB-backed upload settings (merged, not clobbering existing keys) BEFORE processing files — even when the file loop itself is a no-op", async () => {
    const { strapi, spies } = makeUploadStrapiMock({
      files: filesAllConverted,
      settings: { someUnrelatedFlag: "keep-me" },
    });

    const result = await runImageFormatBackfill(strapi as never);

    expect(result).toMatchObject({ skipped: true });
    expect(spies.setSettings).toHaveBeenCalledTimes(1);
    expect(spies.setSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        someUnrelatedFlag: "keep-me",
        responsiveDimensions: true,
        sizeOptimization: true,
        autoOrientation: true,
      }),
    );
    // the file loop itself is skipped (idempotency guard) — no conversion work happens
    expect(spies.generateResponsiveFormats).not.toHaveBeenCalled();
  });

  it("Test 5: never throws even when getSettings rejects — outer try/catch returns {}", async () => {
    const { strapi, spies } = makeUploadStrapiMock({ files: filesNeedingBackfill });
    spies.getSettings.mockRejectedValueOnce(new Error("store unavailable"));

    const result = await runImageFormatBackfill(strapi as never);

    expect(result).toEqual({});
  });
});
