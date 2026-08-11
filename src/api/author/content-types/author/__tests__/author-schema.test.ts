import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Pure JSON-shape test — no Strapi boot, no DB, mirroring the repo's existing
// pure-logic test convention (see redirect/__tests__/redirect-schema.test.ts
// and category/__tests__/category-schema.test.ts).
//
// D-15: Author has `draftAndPublish` off by analogy with D-10 (Category/Tag),
// and an article names at most one author by analogy with D-07. Neither
// choice was put to the user directly; research surfaced no reason to reopen
// either, so both are carried forward as decided rather than silently altered.
//
// D-13 is enforced here as an exact attribute-key-set assertion (not a
// superset check) — that is the mechanism that keeps Author's deliberately
// minimal shape (name + avatar only, no slug/bio/social links) minimal: a
// later addition fails this suite instead of sliding in unnoticed.
//
// The `articles` inverse relation is deliberately absent — `api::article.article`
// does not exist until Plan 06, and a relation pointing at an absent target
// breaks type generation. Plan 06 adds it in the same commit as Article.
import authorSchema from "../schema.json";

const contentTypesDtsPath = path.join(
  __dirname,
  "../../../../../../types/generated/contentTypes.d.ts"
);

describe("Author content type shape", () => {
  it("declares exactly the D-13 domain attributes (name + avatar) plus the Plan 06 articles inverse relation", () => {
    const attrs = authorSchema.attributes as Record<string, unknown>;
    expect(Object.keys(attrs).sort()).toEqual(
      ["articles", "avatar", "name"].sort()
    );
  });

  it("draftAndPublish is off (D-15 — an author is always live)", () => {
    expect(authorSchema.options.draftAndPublish).toBe(false);
  });

  it("name is a plain string", () => {
    const attrs = authorSchema.attributes as Record<string, any>;
    expect(attrs.name.type).toBe("string");
  });

  it("avatar is a single-image media field (narrower than page-template.previewImage)", () => {
    const attrs = authorSchema.attributes as Record<string, any>;
    expect(attrs.avatar).toEqual({
      type: "media",
      multiple: false,
      allowedTypes: ["images"],
    });
  });

  it("does not declare a locale attribute (@strapi/i18n reserves it at boot)", () => {
    const attrs = authorSchema.attributes as Record<string, unknown>;
    expect("locale" in attrs).toBe(false);
  });

  it("declares no attribute as required (a byline-less article and an avatar-less author are both valid)", () => {
    const attrs = authorSchema.attributes as Record<string, any>;
    for (const key of Object.keys(attrs)) {
      expect(attrs[key].required).toBeUndefined();
    }
  });

  it("has no slug, bio or social links attribute (D-13)", () => {
    const attrs = authorSchema.attributes as Record<string, unknown>;
    expect("slug" in attrs).toBe(false);
    expect("bio" in attrs).toBe(false);
    expect("socialLinks" in attrs).toBe(false);
  });

  it("articles is the Plan 06 inverse of article.author (oneToMany, mappedBy: author)", () => {
    const attrs = authorSchema.attributes as Record<string, any>;
    expect(attrs.articles).toEqual({
      type: "relation",
      relation: "oneToMany",
      target: "api::article.article",
      mappedBy: "author",
    });
  });

  it("collection metadata matches api::author.author", () => {
    expect(authorSchema.kind).toBe("collectionType");
    expect(authorSchema.collectionName).toBe("authors");
    expect(authorSchema.info.singularName).toBe("author");
    expect(authorSchema.info.pluralName).toBe("authors");
    expect(authorSchema.info.displayName).toBe("Author");
  });
});

describe("Generated-types-in-sync gate", () => {
  // Mechanically enforces the house rule (D-18) that a Strapi schema change
  // is never committed without the regenerated generated-types file in the
  // same commit.
  it("contentTypes.d.ts declares the api::author.author interface", () => {
    const text = readFileSync(contentTypesDtsPath, "utf-8");
    expect(text).toContain("export interface ApiAuthorAuthor");
    expect(text).toContain("'api::author.author': ApiAuthorAuthor");
  });
});
