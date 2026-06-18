import { defineConfig } from "vitest/config";

// Wave 0 (Phase 5) decision: the Strapi repo had NO test runner. Phase 5's
// migration + lifecycle pure logic (resolveLiveTheme fallback ladder, migration
// idempotency, scoped (theme,key) uniqueness) must be unit-testable BEFORE the
// production modules land. This config runs those pure-logic suites in a Node
// environment — no Strapi server boot, no DB; the `strapi` surface is injected
// via the fixtures' makeStrapiMock() factory.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
