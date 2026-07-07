/**
 * Phase 11 Plan 07 — idempotent per-tenant image-format backfill migration
 * (D-02, D-03).
 *
 * Plan 01's WebP conversion (a `generateResponsiveFormats` plugin-extension
 * override, see `src/extensions/upload/strapi-server.ts`) only affects images
 * uploaded AFTER it shipped. Every already-uploaded image (the report's
 * hero/logo images among them) never got a `webp` format entry generated for
 * it. This migration re-runs that same WebP-extended pipeline against every
 * already-uploaded image that is still missing `formats.webp`, and turns on
 * the DB-backed Upload settings (`responsiveDimensions`/`sizeOptimization`/
 * `autoOrientation`) that gate responsive-format generation in the first
 * place (RESEARCH Pitfall 1 — these are `strapi.store()`-backed settings,
 * NOT `config/plugins.ts` values).
 *
 * Modeled 1:1 on `theme-scope.ts`'s `runThemeScopeMigration` shape (JSDoc
 * header, exported async function, outer try/catch, per-step console
 * logging) and wired into `bootstrap()` the same way — runs every boot,
 * short-circuits when already done.
 */

export interface BackfillResult {
  skipped?: boolean;
  migrated?: boolean;
  count?: number;
}

/**
 * IDEMPOTENT per-tenant backfill. Wired into bootstrap() — runs every boot.
 */
export async function runImageFormatBackfill(strapi: any): Promise<BackfillResult> {
  try {
    const uploadService = strapi.plugin("upload").service("upload");
    const imageManipulationService = strapi.plugin("upload").service("image-manipulation");

    // (1) DB-backed Upload settings — spread the EXISTING settings first, the
    // new enablement flags second so they always win, never clobbering any
    // other unrelated existing setting key (RESEARCH Pitfall 1). This runs
    // UNCONDITIONALLY, even when the file loop below turns out to be a no-op
    // (a fully-converted tenant still needs these settings correctly enabled
    // for any future upload).
    const existingSettings = (await uploadService.getSettings()) ?? {};
    const mergedSettings = {
      ...existingSettings,
      responsiveDimensions: true,
      sizeOptimization: true,
      autoOrientation: true,
    };
    await uploadService.setSettings(mergedSettings);

    // (2) Every image file across the tenant's media library.
    const files: Array<{ id: number; formats?: Record<string, unknown> }> = await strapi.db
      .query("plugin::upload.file")
      .findMany({ where: { mime: { $startsWith: "image/" } } });

    const rows = files ?? [];

    // (3) IDEMPOTENCY GUARD — if every file already has formats.webp, the
    // tenant is fully migrated; the file loop is skipped (zero further work,
    // zero writes) — only the settings call above still runs.
    const alreadyFullyConverted = rows.every((file) => Boolean(file?.formats?.webp));
    if (alreadyFullyConverted) {
      return { skipped: true };
    }

    // (4) For each file missing formats.webp, re-run the (now WebP-extended)
    // generateResponsiveFormats pipeline and read-merge-write the result onto
    // the file's existing `formats` — NEVER a bare assignment, so pre-existing
    // thumbnail/small/medium/large entries always survive (T-11-10).
    let count = 0;
    for (const file of rows) {
      if (file?.formats?.webp) continue; // already converted — skip

      try {
        const results: Array<{ key: string; file: unknown }> =
          await imageManipulationService.generateResponsiveFormats(file);

        const webpEntry = (results ?? []).find((entry) => entry?.key === "webp");
        if (!webpEntry) continue; // conversion produced no webp entry — nothing to persist

        const merged = { ...(file.formats ?? {}), webp: webpEntry.file };
        await strapi.db.query("plugin::upload.file").update({
          where: { id: file.id },
          data: { formats: merged },
        });
        count += 1;
      } catch (err) {
        // (5) A single corrupt/unreadable file must never abort the tenant's
        // migration — log and continue to the next file (T-11-11).
        console.error("[image-format-backfill] failed for file", file?.id, err);
      }
    }

    return { migrated: true, count };
  } catch (err) {
    console.error("[image-format-backfill] migration failed:", err);
    return {};
  }
}
