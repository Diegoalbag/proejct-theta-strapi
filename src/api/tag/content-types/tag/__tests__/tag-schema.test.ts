import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Pure JSON-shape test — no Strapi boot, no DB, mirroring the repo's existing
// pure-logic test convention (see redirect/__tests__/redirect-schema.test.ts
// and category/__tests__/category-schema.test.ts).
//
// D-06: Tag is a separate collection type from Category, not one type with a
// `kind` discriminator — that split is what gives Phase 22 distinct archive
// routes and Phase 20 separate pickers with no filtering.
//
// `draftAndPublish: false` is D-10, same rationale as Category: a draft tag
// would be assignable to an article in the Phase 20 editor and then silently
// absent from the live site.
//
// The `articles` inverse relation is deliberately absent — `api::article.article`
// does not exist until Plan 06, and a relation pointing at an absent target
// breaks type generation. Plan 06 adds it in the same commit as Article.
import tagSchema from "../schema.json";

const contentTypesDtsPath = path.join(
  __dirname,
  "../../../../../../types/generated/contentTypes.d.ts"
);

describe("Tag content type shape", () => {
  it("declares exactly the three D-09-style domain attributes plus the Plan 06 articles inverse relation", () => {
    const attrs = tagSchema.attributes as Record<string, unknown>;
    expect(Object.keys(attrs).sort()).toEqual(
      ["articles", "description", "name", "slug"].sort()
    );
  });

  it("draftAndPublish is off (D-10 — taxonomy records are always live)", () => {
    expect(tagSchema.options.draftAndPublish).toBe(false);
  });

  it("name is a plain string", () => {
    const attrs = tagSchema.attributes as Record<string, any>;
    expect(attrs.name.type).toBe("string");
  });

  it("slug is a uid targeting name", () => {
    const attrs = tagSchema.attributes as Record<string, any>;
    expect(attrs.slug.type).toBe("uid");
    expect(attrs.slug.targetField).toBe("name");
  });

  it("description is text", () => {
    const attrs = tagSchema.attributes as Record<string, any>;
    expect(attrs.description.type).toBe("text");
  });

  it("does not declare a locale attribute (@strapi/i18n reserves it at boot)", () => {
    const attrs = tagSchema.attributes as Record<string, unknown>;
    expect("locale" in attrs).toBe(false);
  });

  it("declares no attribute as required", () => {
    const attrs = tagSchema.attributes as Record<string, any>;
    for (const key of Object.keys(attrs)) {
      expect(attrs[key].required).toBeUndefined();
    }
  });

  it("articles is the Plan 06 inverse of article.tags (manyToMany, mappedBy: tags)", () => {
    const attrs = tagSchema.attributes as Record<string, any>;
    expect(attrs.articles).toEqual({
      type: "relation",
      relation: "manyToMany",
      target: "api::article.article",
      mappedBy: "tags",
    });
  });

  it("collection metadata matches api::tag.tag", () => {
    expect(tagSchema.kind).toBe("collectionType");
    expect(tagSchema.collectionName).toBe("tags");
    expect(tagSchema.info.singularName).toBe("tag");
    expect(tagSchema.info.pluralName).toBe("tags");
    expect(tagSchema.info.displayName).toBe("Tag");
  });
});

describe("Generated-types-in-sync gate", () => {
  // Mechanically enforces the house rule (D-18) that a Strapi schema change
  // is never committed without the regenerated generated-types file in the
  // same commit.
  it("contentTypes.d.ts declares the api::tag.tag interface", () => {
    const text = readFileSync(contentTypesDtsPath, "utf-8");
    expect(text).toContain("export interface ApiTagTag");
    expect(text).toContain("'api::tag.tag': ApiTagTag");
  });
});
