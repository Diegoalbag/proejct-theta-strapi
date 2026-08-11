import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Pure JSON-shape test — no Strapi boot, no DB, mirroring the repo's existing
// pure-logic test convention (see redirect/__tests__/redirect-schema.test.ts).
//
// `draftAndPublish: false` is D-10: a draft taxonomy record would be
// assignable to an article in the Phase 20 editor and then silently absent
// from the live site, an opaque bug for a non-technical client. Archive
// visibility instead derives from whether any published article uses the
// term.
//
// Flat (no parent/child self-relation) is D-08: nesting would push
// arbitrary-depth handling into Phase 22 routing, canonicals and the
// sitemap, plus cycle validation — deferred, not rejected.
//
// The attribute literally reserved by `@strapi/i18n` at boot (`locale`) is
// documented in full in src/api/site/content-types/site/schema.json's own
// `info.description`, and recorded in 14-01-SUMMARY.md.
import categorySchema from "../schema.json";

const contentTypesDtsPath = path.join(
  __dirname,
  "../../../../../../types/generated/contentTypes.d.ts"
);

describe("Category content type shape", () => {
  it("declares exactly the three D-09 domain attributes", () => {
    const attrs = categorySchema.attributes as Record<string, unknown>;
    expect(Object.keys(attrs).sort()).toEqual(
      ["description", "name", "slug"].sort()
    );
  });

  it("draftAndPublish is off (D-10 — taxonomy records are always live)", () => {
    expect(categorySchema.options.draftAndPublish).toBe(false);
  });

  it("name is a plain string", () => {
    const attrs = categorySchema.attributes as Record<string, any>;
    expect(attrs.name.type).toBe("string");
  });

  it("slug is a uid targeting name", () => {
    const attrs = categorySchema.attributes as Record<string, any>;
    expect(attrs.slug.type).toBe("uid");
    expect(attrs.slug.targetField).toBe("name");
  });

  it("description is text", () => {
    const attrs = categorySchema.attributes as Record<string, any>;
    expect(attrs.description.type).toBe("text");
  });

  it("does not declare a locale attribute (@strapi/i18n reserves it at boot)", () => {
    const attrs = categorySchema.attributes as Record<string, unknown>;
    expect("locale" in attrs).toBe(false);
  });

  it("declares no attribute as required (D-16: tenants start empty, a name-only category must validate)", () => {
    const attrs = categorySchema.attributes as Record<string, any>;
    for (const key of Object.keys(attrs)) {
      expect(attrs[key].required).toBeUndefined();
    }
  });

  it("has no parent/child self-relation (D-08 — categories are flat)", () => {
    const attrs = categorySchema.attributes as Record<string, unknown>;
    expect("parent" in attrs).toBe(false);
    expect("children" in attrs).toBe(false);
    expect("categories" in attrs).toBe(false);
  });

  it("collection metadata matches api::category.category", () => {
    expect(categorySchema.kind).toBe("collectionType");
    expect(categorySchema.collectionName).toBe("categories");
    expect(categorySchema.info.singularName).toBe("category");
    expect(categorySchema.info.pluralName).toBe("categories");
    expect(categorySchema.info.displayName).toBe("Category");
  });
});

describe("Generated-types-in-sync gate", () => {
  // Mechanically enforces the house rule (D-18) that a Strapi schema change
  // is never committed without the regenerated generated-types file in the
  // same commit.
  it("contentTypes.d.ts declares the api::category.category interface", () => {
    const text = readFileSync(contentTypesDtsPath, "utf-8");
    expect(text).toContain("export interface ApiCategoryCategory");
    expect(text).toContain("'api::category.category': ApiCategoryCategory");
  });
});
