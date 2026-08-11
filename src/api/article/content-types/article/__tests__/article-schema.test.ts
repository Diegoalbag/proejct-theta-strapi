import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Pure JSON-shape test — no Strapi boot, no DB, mirroring the repo's existing
// pure-logic test convention (see redirect/__tests__/redirect-schema.test.ts,
// category/__tests__/category-schema.test.ts, tag/__tests__/tag-schema.test.ts).
//
// D-01 / Plan 05 checkpoint: the article body is sanitized HTML stored in a
// Strapi `richtext` field. `article` (api::article.article) was confirmed by
// the maintainer at the Plan 05 Task 1 checkpoint (19-05-DECISIONS.md) — no
// override from the planner's recommendation occurred.
//
// D-05: publish state is Strapi's native `publishedAt` via
// `draftAndPublish: true` — there is no custom status/state/publishState
// attribute on Article.
//
// D-04: `seo` attaches the existing non-repeatable `shared.seo` component
// byte-identical to `Page.seo`, which is what makes the Phase 15
// site-to-page fallback chain and the SERP preview apply to articles with no
// new SEO vocabulary.
//
// Slug policy (19-05-DECISIONS.md discretionary item 3): `uid` uniqueness is
// scoped per content type only. An article slug may equal a page slug — no
// cross-type uniqueness mechanism, no lifecycle hook file under
// src/api/article/.
//
// Tag ordering is deliberately unpinned: no default sort is declared on the
// `tags` manyToMany relation, so GraphQL's join-table order is whatever
// Strapi yields (edge: BLOG-02/ordering).
import articleSchema from "../schema.json";
import categorySchema from "../../../../category/content-types/category/schema.json";
import tagSchema from "../../../../tag/content-types/tag/schema.json";
import authorSchema from "../../../../author/content-types/author/schema.json";

const contentTypesDtsPath = path.join(
  __dirname,
  "../../../../../../types/generated/contentTypes.d.ts"
);

const lifecyclesPath = path.join(__dirname, "../lifecycles.ts");

describe("Article content type shape", () => {
  it("declares exactly the ten domain attributes", () => {
    const attrs = articleSchema.attributes as Record<string, unknown>;
    expect(Object.keys(attrs).sort()).toEqual(
      [
        "author",
        "body",
        "canonicalUrl",
        "category",
        "excerpt",
        "featuredImage",
        "seo",
        "slug",
        "tags",
        "title",
      ].sort()
    );
  });

  it("draftAndPublish is on (D-05 — publish state is native publishedAt)", () => {
    expect(articleSchema.options.draftAndPublish).toBe(true);
  });

  it("does not declare a custom status/state/publishState attribute", () => {
    const attrs = articleSchema.attributes as Record<string, unknown>;
    expect("status" in attrs).toBe(false);
    expect("state" in attrs).toBe(false);
    expect("publishState" in attrs).toBe(false);
  });

  it("title is a plain string and canonicalUrl matches Page.canonicalUrl", () => {
    const attrs = articleSchema.attributes as Record<string, any>;
    expect(attrs.title.type).toBe("string");
    expect(attrs.canonicalUrl.type).toBe("string");
  });

  it("slug is a uid targeting title", () => {
    const attrs = articleSchema.attributes as Record<string, any>;
    expect(attrs.slug.type).toBe("uid");
    expect(attrs.slug.targetField).toBe("title");
  });

  it("body is richtext (D-01)", () => {
    const attrs = articleSchema.attributes as Record<string, any>;
    expect(attrs.body.type).toBe("richtext");
  });

  it("excerpt is text, not string (D-03 — unbounded, no server-side truncation)", () => {
    const attrs = articleSchema.attributes as Record<string, any>;
    expect(attrs.excerpt.type).toBe("text");
  });

  it("featuredImage matches the shared.seo shareImage shape, not page-template's wider previewImage (D-02)", () => {
    const attrs = articleSchema.attributes as Record<string, any>;
    expect(attrs.featuredImage).toEqual({
      type: "media",
      multiple: false,
      allowedTypes: ["images"],
    });
  });

  it("seo deep-equals Page.seo (D-04)", () => {
    const attrs = articleSchema.attributes as Record<string, any>;
    expect(attrs.seo).toEqual({
      type: "component",
      component: "shared.seo",
      repeatable: false,
    });
  });

  it("does not declare a locale attribute (@strapi/i18n reserves it at boot)", () => {
    const attrs = articleSchema.attributes as Record<string, unknown>;
    expect("locale" in attrs).toBe(false);
  });

  it("declares no attribute as required — a title-and-body-only article is publishable (D-03/D-11/D-14/D-16)", () => {
    const attrs = articleSchema.attributes as Record<string, any>;
    for (const key of Object.keys(attrs)) {
      expect(attrs[key].required).toBeUndefined();
    }
  });

  it("declares no attribute as repeatable — does not reintroduce the repeatable-component save-timeout shape", () => {
    const attrs = articleSchema.attributes as Record<string, any>;
    for (const key of Object.keys(attrs)) {
      expect(attrs[key].repeatable).not.toBe(true);
    }
  });

  it("slug uniqueness is scoped per content type: no lifecycle hook exists under src/api/article/ (an article slug may equal a page slug)", () => {
    expect(existsSync(lifecyclesPath)).toBe(false);
  });

  it("collection metadata matches api::article.article", () => {
    expect(articleSchema.kind).toBe("collectionType");
    expect(articleSchema.collectionName).toBe("articles");
    expect(articleSchema.info.singularName).toBe("article");
    expect(articleSchema.info.pluralName).toBe("articles");
    expect(articleSchema.info.displayName).toBe("Article");
  });
});

describe("Article <-> taxonomy relation wiring (both ends asserted in one suite run)", () => {
  it("article.category <-> category.articles", () => {
    const articleAttrs = articleSchema.attributes as Record<string, any>;
    const categoryAttrs = categorySchema.attributes as Record<string, any>;
    expect(articleAttrs.category).toEqual({
      type: "relation",
      relation: "manyToOne",
      target: "api::category.category",
      inversedBy: "articles",
    });
    expect(categoryAttrs.articles).toEqual({
      type: "relation",
      relation: "oneToMany",
      target: "api::article.article",
      mappedBy: "category",
    });
  });

  it("article.tags <-> tag.articles", () => {
    const articleAttrs = articleSchema.attributes as Record<string, any>;
    const tagAttrs = tagSchema.attributes as Record<string, any>;
    expect(articleAttrs.tags).toEqual({
      type: "relation",
      relation: "manyToMany",
      target: "api::tag.tag",
      inversedBy: "articles",
    });
    expect(tagAttrs.articles).toEqual({
      type: "relation",
      relation: "manyToMany",
      target: "api::article.article",
      mappedBy: "tags",
    });
  });

  it("article.author <-> author.articles", () => {
    const articleAttrs = articleSchema.attributes as Record<string, any>;
    const authorAttrs = authorSchema.attributes as Record<string, any>;
    expect(articleAttrs.author).toEqual({
      type: "relation",
      relation: "manyToOne",
      target: "api::author.author",
      inversedBy: "articles",
    });
    expect(authorAttrs.articles).toEqual({
      type: "relation",
      relation: "oneToMany",
      target: "api::article.article",
      mappedBy: "author",
    });
  });

  it("Category's attribute key set widens to exactly four", () => {
    const attrs = categorySchema.attributes as Record<string, unknown>;
    expect(Object.keys(attrs).sort()).toEqual(
      ["articles", "description", "name", "slug"].sort()
    );
  });

  it("Tag's attribute key set widens to exactly four", () => {
    const attrs = tagSchema.attributes as Record<string, unknown>;
    expect(Object.keys(attrs).sort()).toEqual(
      ["articles", "description", "name", "slug"].sort()
    );
  });

  it("Author's attribute key set widens to exactly three", () => {
    const attrs = authorSchema.attributes as Record<string, unknown>;
    expect(Object.keys(attrs).sort()).toEqual(
      ["articles", "avatar", "name"].sort()
    );
  });
});

describe("Generated-types-in-sync gate", () => {
  // Mechanically enforces the house rule (D-18) that a Strapi schema change
  // is never committed without the regenerated generated-types file in the
  // same commit.
  it("contentTypes.d.ts declares the api::article.article interface", () => {
    const text = readFileSync(contentTypesDtsPath, "utf-8");
    expect(text).toContain("export interface ApiArticleArticle");
    expect(text).toContain("'api::article.article': ApiArticleArticle");
  });

  it("contentTypes.d.ts's ApiArticleArticle interface declares body as RichText", () => {
    // Pins that the richtext choice actually survived generation, in the
    // same spirit as the redirect test pinning its enum verbatim.
    const text = readFileSync(contentTypesDtsPath, "utf-8");
    expect(text).toContain("body: Schema.Attribute.RichText");
  });
});
