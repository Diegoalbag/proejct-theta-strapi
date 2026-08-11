import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Pure JSON-shape test — no Strapi boot, no DB, mirroring the repo's existing
// pure-logic test convention (see site/__tests__/seo-schema.test.ts).
//
// Pins Phase 16 Plan 01's Task 1 decision: `redirectType` (not `statusCode`)
// with word-valued enum members `["permanent", "temporary"]`. That shape was
// chosen specifically because GraphQL enum VALUE names cannot begin with a
// digit — `@strapi/plugin-graphql` would have to sanitize `"301"`/`"302"`
// into something else, an unverified risk this project declined to carry
// into a one-way schema migration. See 16-01-SUMMARY.md for the recorded
// decision.
import redirectSchema from "../schema.json";
import pageSchema from "../../../../page/content-types/page/schema.json";
import seoComponent from "../../../../../components/shared/seo.json";

const contentTypesDtsPath = path.join(
  __dirname,
  "../../../../../../types/generated/contentTypes.d.ts"
);

describe("Redirect content type shape (Task 1 decision: redirectType, word-valued enum)", () => {
  it("declares exactly the four domain attributes plus draftAndPublish: false", () => {
    const attrs = redirectSchema.attributes as Record<string, unknown>;
    expect(Object.keys(attrs).sort()).toEqual(
      ["destination", "redirectType", "source", "trackClicks"].sort()
    );
    expect(redirectSchema.options.draftAndPublish).toBe(false);
  });

  it("source and destination are required strings", () => {
    const attrs = redirectSchema.attributes as Record<string, any>;
    expect(attrs.source.type).toBe("string");
    expect(attrs.source.required).toBe(true);
    expect(attrs.destination.type).toBe("string");
    expect(attrs.destination.required).toBe(true);
  });

  it("redirectType is an enumeration of exactly ['permanent', 'temporary'], defaulting to 'permanent'", () => {
    const attrs = redirectSchema.attributes as Record<string, any>;
    expect(attrs.redirectType.type).toBe("enumeration");
    expect(attrs.redirectType.enum).toEqual(["permanent", "temporary"]);
    expect(attrs.redirectType.default).toBe("permanent");
    expect(attrs.redirectType.required).toBe(true);
  });

  it("trackClicks is an optional boolean defaulting to false (REQ-2)", () => {
    // Default false, never required: every redirect that existed before this
    // field reads as untracked, which is the only safe interpretation — an
    // absent value must never be inferred as consent to count.
    const attrs = redirectSchema.attributes as Record<string, any>;
    expect(attrs.trackClicks.type).toBe("boolean");
    expect(attrs.trackClicks.default).toBe(false);
    expect(attrs.trackClicks.required).toBeUndefined();
  });

  it("collection metadata matches api::redirect.redirect", () => {
    expect(redirectSchema.collectionName).toBe("redirects");
    expect(redirectSchema.info.singularName).toBe("redirect");
    expect(redirectSchema.info.pluralName).toBe("redirects");
  });
});

describe("Page.canonicalUrl (15 D-03: rides the same migration as this phase's Redirect content type)", () => {
  it("Page carries canonicalUrl as a top-level string attribute", () => {
    const attrs = pageSchema.attributes as Record<string, any>;
    expect(attrs.canonicalUrl).toBeDefined();
    expect(attrs.canonicalUrl.type).toBe("string");
  });

  it("shared.seo does NOT carry a canonical attribute (15 D-01 structural guard: a site-level canonical would point every page at one URL)", () => {
    const attrs = seoComponent.attributes as Record<string, unknown>;
    expect("canonical" in attrs).toBe(false);
    expect("canonicalUrl" in attrs).toBe(false);
  });
});

describe("Generated-types-in-sync gate", () => {
  // Mechanically enforces the house rule that a Strapi schema change is never
  // committed without the regenerated generated-types files in the same commit.
  it("contentTypes.d.ts declares the api::redirect.redirect interface", () => {
    const text = readFileSync(contentTypesDtsPath, "utf-8");
    expect(text).toContain("export interface ApiRedirectRedirect");
    expect(text).toContain("'api::redirect.redirect': ApiRedirectRedirect");
  });

  it("contentTypes.d.ts's ApiRedirectRedirect interface declares the redirectType enum verbatim", () => {
    const text = readFileSync(contentTypesDtsPath, "utf-8");
    expect(text).toContain(
      "redirectType: Schema.Attribute.Enumeration<['permanent', 'temporary']>"
    );
  });

  it("contentTypes.d.ts's ApiRedirectRedirect interface declares trackClicks", () => {
    // The platform's GetRedirects query selects this field, so a schema
    // change that shipped without the regenerated types would break the
    // production Docker build before any tenant ever saw the field.
    const text = readFileSync(contentTypesDtsPath, "utf-8");
    expect(text).toContain(
      "trackClicks: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>"
    );
  });

  it("contentTypes.d.ts contains a canonicalUrl member on the Page interface", () => {
    const text = readFileSync(contentTypesDtsPath, "utf-8");
    expect(text).toContain("canonicalUrl: Schema.Attribute.String");
  });
});
