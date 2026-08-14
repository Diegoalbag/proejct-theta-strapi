import { buildUploadConfig } from "../src/utils/upload-provider";

export default ({ env }: { env: (key: string, def?: string) => string }) => ({
  graphql: {
    config: {
      defaultLimit: 100,
      maxLimit: 200,
    },
  },
  upload: {
    config: {
      // Phase 11 Plan 01 (D-03): large/medium/small are pinned to Strapi's own
      // DEFAULT_BREAKPOINTS (confirmed from image-manipulation.js), guarding
      // against a future Strapi version silently changing its internal default
      // out from under the WebP-conversion override.
      //
      // `xlarge` is an ADDITION, not a pin (debug session 2026-08-14,
      // .planning/debug/image-quality-perf-regression.md). Stopping the ladder
      // at 1000px meant every full-bleed image — rendered at sizes="100vw" —
      // had no srcset candidate above 1000w on any viewport wider than that,
      // so the browser picked 1000w and CSS-upscaled it: visible blur on
      // desktop, worse on retina.
      //
      // 1920 is chosen to sit between the old 1000px cap and the true original
      // (now also offered as a candidate by the theme's buildSrcSet). Without
      // a rung here, a 1920px desktop jumps straight from 1000w to the full
      // original — for the Fixocargo hero that is 415 KB instead of ~45 KB —
      // trading blur for weight. This rung is what makes the srcset fix a net
      // win rather than a swap of one symptom for another.
      //
      // NOTE: Strapi generates variants at UPLOAD time and only when the
      // breakpoint is smaller than the source. Adding this does nothing for
      // already-uploaded media — that needs src/migrations/image-format-
      // backfill.ts re-run, or a re-upload.
      breakpoints: {
        xlarge: 1920,
        large: 1000,
        medium: 750,
        small: 500,
      },
      // S3-compatible object storage when configured, local disk otherwise.
      // See config/upload-provider.ts for why this is conditional.
      ...buildUploadConfig(env),
    },
  },
});
