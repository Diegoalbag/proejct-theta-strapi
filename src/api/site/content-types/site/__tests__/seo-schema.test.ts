import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Pure JSON-shape test — no Strapi boot, no DB, mirroring the repo's existing
// pure-logic test convention (see page-template/__tests__/theme-key-unique.test.ts).
//
// This suite pins the load-bearing invariants of Phase 14 Plan 01's one-way
// schema decision (D-01): a single non-repeatable `shared.seo` component
// attached to both Page and Site, plus the reserved-name gate that forced
// the site locale attribute to be named `siteLocale` instead of `locale`
// (see Task 1's checkpoint / 14-01-SUMMARY.md).
import seoComponent from "../../../../../components/shared/seo.json";
import pageSchema from "../../../../page/content-types/page/schema.json";
import siteSchema from "../schema.json";

const componentsDtsPath = path.join(
  __dirname,
  "../../../../../../types/generated/components.d.ts"
);
const contentTypesDtsPath = path.join(
  __dirname,
  "../../../../../../types/generated/contentTypes.d.ts"
);

describe("shared.seo component shape", () => {
  it("declares exactly the four required attributes", () => {
    const attrs = seoComponent.attributes as Record<string, unknown>;
    expect(Object.keys(attrs).sort()).toEqual(
      ["description", "noindex", "shareImage", "title"].sort()
    );
  });

  it("shareImage is a single-image media attribute", () => {
    const attrs = seoComponent.attributes as Record<string, any>;
    expect(attrs.shareImage.type).toBe("media");
    expect(attrs.shareImage.multiple).toBe(false);
    expect(attrs.shareImage.allowedTypes).toEqual(["images"]);
  });

  it("noindex is a boolean defaulting to false", () => {
    const attrs = seoComponent.attributes as Record<string, any>;
    expect(attrs.noindex.type).toBe("boolean");
    expect(attrs.noindex.default).toBe(false);
  });
});

describe("Page.seo and Site.seo attachment (D-01: non-repeatable, load-bearing)", () => {
  it("Page.attributes.seo is a non-repeatable shared.seo component", () => {
    const seo = (pageSchema.attributes as Record<string, any>).seo;
    expect(seo.type).toBe("component");
    expect(seo.component).toBe("shared.seo");
    // toBe(false), not a falsy check — an absent `repeatable` key must fail this.
    expect(seo.repeatable).toBe(false);
  });

  it("Site.attributes.seo is a non-repeatable shared.seo component", () => {
    const seo = (siteSchema.attributes as Record<string, any>).seo;
    expect(seo.type).toBe("component");
    expect(seo.component).toBe("shared.seo");
    expect(seo.repeatable).toBe(false);
  });
});

describe("Site scalar fields (siteUrl, siteLocale, Phase-15 fields)", () => {
  it("declares siteUrl, siteLocale, titleTemplate, and the three verification fields as strings", () => {
    const attrs = siteSchema.attributes as Record<string, any>;
    const keys = [
      "siteUrl",
      "siteLocale",
      "titleTemplate",
      "verificationGoogle",
      "verificationBing",
      "verificationYandex",
    ];
    for (const key of keys) {
      expect(attrs[key]).toBeDefined();
      expect(attrs[key].type).toBe("string");
    }
  });
});

describe("Reserved-name gate (T-14-04)", () => {
  // @strapi/i18n's extendContentTypes (node_modules/@strapi/i18n/dist/server/register.js)
  // runs `_.set(attributes, 'locale', { private: !isLocalized, configurable: false, ... })`
  // over EVERY content type at boot, overwriting (not merging) any user-declared
  // `locale` attribute. It also owns `localizations` outright. A user attribute
  // colliding with either name is silently replaced with a private, invisible one
  // that @strapi/plugin-graphql's isNotPrivate filter drops from the GraphQL
  // schema entirely — which fails the WHOLE Site query, not just this field.
  // This is why the site locale attribute is named `siteLocale`, not `locale`.
  // Do not "fix" this back — see Task 1 / 14-01-SUMMARY.md for the full evidence.
  it("Page.attributes has no key named `locale` or `localizations`", () => {
    const attrs = pageSchema.attributes as Record<string, unknown>;
    expect("locale" in attrs).toBe(false);
    expect("localizations" in attrs).toBe(false);
  });

  it("Site.attributes has no key named `locale` or `localizations`", () => {
    const attrs = siteSchema.attributes as Record<string, unknown>;
    expect("locale" in attrs).toBe(false);
    expect("localizations" in attrs).toBe(false);
  });
});

describe("Generated-types-in-sync gate", () => {
  // Mechanically enforces the house rule that a Strapi schema change is never
  // committed without the regenerated generated-types files in the same commit.
  it("components.d.ts declares SharedSeo and registers 'shared.seo'", () => {
    const text = readFileSync(componentsDtsPath, "utf-8");
    expect(text).toContain("SharedSeo");
    expect(text).toContain("'shared.seo'");
  });

  it("contentTypes.d.ts contains the siteLocale attribute", () => {
    const text = readFileSync(contentTypesDtsPath, "utf-8");
    expect(text).toContain("siteLocale");
  });
});
