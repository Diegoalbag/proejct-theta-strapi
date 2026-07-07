export default () => ({
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
    },
  },
});
