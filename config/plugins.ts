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
      // Phase 11 Plan 01 (D-03): pinned to Strapi's own current
      // DEFAULT_BREAKPOINTS (confirmed from image-manipulation.js). This is
      // documentation/pinning only — zero behavior change today — guarding
      // against a future Strapi version silently changing its internal
      // default out from under the WebP-conversion override.
      breakpoints: {
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
