/**
 * The form-ingest token's permission set, and the bootstrap's self-healing.
 *
 * WHY THIS EXISTS
 * The ingest token is minted `type: 'custom'` with an explicit permission list.
 * It is intuitive — and wrong — to scope it to `form-submission.create` alone:
 * a FormSubmission carries a `form` relation, and Strapi's `validateInput` runs
 * `throwRestrictedRelations(auth)` over the request BODY, rejecting a relation
 * that points at a content type the token cannot reach. The result is
 * `ValidationError: Invalid key form` and a 400 on EVERY submission — which is
 * exactly what shipped, and what no other test caught, because the tenant
 * route's own tests mock the Strapi fetch and so never exercise Strapi's
 * validation.
 *
 * These tests pin the two halves of the fix:
 *   1. the permission list still grants read on `api::form.form`, and
 *   2. an already-minted token with a stale list is HEALED rather than skipped.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const SOURCE = readFileSync(resolve(__dirname, "../index.ts"), "utf-8");

/**
 * Read the permission list out of the source as TEXT.
 *
 * Importing `src/index.ts` would boot the whole Strapi bootstrap module and its
 * `Core.Strapi` types for what is a static invariant, so this follows the same
 * source-scanning approach the theme repo uses for its registry guards.
 */
function readPermissions(): string[] {
  const block = SOURCE.match(/const FORM_INGEST_PERMISSIONS = \[([\s\S]*?)\];/);
  if (!block) throw new Error("Could not locate FORM_INGEST_PERMISSIONS in src/index.ts");
  return Array.from(block[1].matchAll(/'([^']+)'/g), (m) => m[1]);
}

describe("form-ingest token permissions", () => {
  it("can create a submission and upload its attachments", () => {
    const permissions = readPermissions();
    expect(permissions).toContain("api::form-submission.form-submission.create");
    expect(permissions).toContain("plugin::upload.content-api.upload");
  });

  it("can READ Form — without this every submission 400s on the `form` relation", () => {
    const permissions = readPermissions();
    // Both actions: `findOne` is the one the relation check needs, `find` keeps
    // the grant consistent with how Strapi models read access for a type.
    expect(permissions).toContain("api::form.form.findOne");
    expect(permissions).toContain("api::form.form.find");
  });

  it("stays create-only for WRITES — the property the ingest route depends on", () => {
    const permissions = readPermissions();
    // Read on Form is deliberate (definitions are already public via
    // NEXT_PUBLIC_STRAPI_TOKEN). Any UPDATE/DELETE grant, or a write grant on
    // any other content type, is not.
    const forbidden = permissions.filter(
      (p) => /\.(update|delete)$/.test(p) || /^api::(?!form-submission\.form-submission\.create$|form\.form\.(find|findOne)$)/.test(p)
    );
    expect(forbidden).toEqual([]);
  });
});

describe("bootstrap heals a stale token instead of skipping it", () => {
  it("no longer returns early on ANY existing token", () => {
    // The original `if (existing) return;` stranded every tenant minted before
    // the Form read grant existed: permissions are fixed at creation, so those
    // tokens could never write a submission.
    expect(SOURCE).not.toMatch(/if \(existing\) return;/);
  });

  it("updates the token in place, preserving the access key", () => {
    // `update` and NOT revoke-and-recreate: the platform already holds a copy of
    // this key. Recreating it would require a second callback and leave a window
    // where the tenant site holds a revoked token.
    expect(SOURCE).toMatch(/\.update\(existing\.id, \{\s*permissions: FORM_INGEST_PERMISSIONS/);
    expect(SOURCE).not.toMatch(/revoke\(existing\.id\)/);
  });

  it("only heals when something is actually missing", () => {
    // A no-op boot must not write to the token table on every restart.
    expect(SOURCE).toMatch(/if \(missing\.length === 0\) return;/);
  });
});
