/**
 * Scoped (theme, key) uniqueness for Form.
 *
 * Same contract as the PageTemplate suite
 * (src/api/page-template/content-types/page-template/__tests__/theme-key-unique.test.ts),
 * for the same reasons: Strapi v5 `unique: true` is global per content-type and
 * cannot scope to a relation, and with draftAndPublish Strapi skips its own unique
 * checks on drafts — so the lifecycle hook is the only reliable gate.
 *
 * Why forms need it: `key` is what the theme's form section and the
 * `{{form:key}}` richtext token resolve against. A duplicate key within one theme
 * makes embed resolution ambiguous.
 *
 * This uses a local strapi mock rather than makeStrapiMock from
 * migrations/__fixtures__/theme-scope.fixtures — that factory is scoped to the
 * theme-scope migration and throws on any uid outside its three known ones.
 */

import { describe, expect, it, vi } from "vitest";
import { assertUniqueThemeKey } from "../lifecycles";

interface FormRow {
  documentId: string;
  key: string;
  theme?: { documentId: string } | null;
}

/** Fake `strapi` whose documents('api::form.form').findMany honors the two filters the hook sends. */
function makeFormStrapiMock(rows: FormRow[] = []) {
  const findMany = vi.fn(async (args?: any) => {
    const filters = args?.filters ?? {};
    let out = [...rows];
    if (filters?.key?.$eq !== undefined) {
      out = out.filter((r) => r.key === filters.key.$eq);
    }
    if (filters?.theme?.documentId?.$eq !== undefined) {
      out = out.filter((r) => r.theme?.documentId === filters.theme.documentId.$eq);
    }
    return out;
  });

  const documents = vi.fn((uid: string) => {
    if (uid === "api::form.form") return { findMany };
    throw new Error(`makeFormStrapiMock: unexpected uid "${uid}"`);
  });

  return { strapi: { documents, log: { warn: vi.fn(), info: vi.fn(), error: vi.fn() } }, findMany };
}

const existing = (key: string, themeId: string, documentId: string): FormRow => ({
  documentId,
  key,
  theme: { documentId: themeId },
});

describe("assertUniqueThemeKey (Form) — scoped (theme,key) uniqueness", () => {
  it("throws when the same key exists under the SAME theme", async () => {
    const { strapi } = makeFormStrapiMock([existing("contact-us", "theme-1", "form-existing")]);

    await expect(
      assertUniqueThemeKey(strapi as never, { key: "contact-us", theme: "theme-1" })
    ).rejects.toThrow(/already exists/i);
  });

  it("allows the same key under a DIFFERENT theme (cross-theme coexistence)", async () => {
    const { strapi } = makeFormStrapiMock([existing("contact-us", "theme-OTHER", "form-existing")]);

    await expect(
      assertUniqueThemeKey(strapi as never, { key: "contact-us", theme: "theme-1" })
    ).resolves.not.toThrow();
  });

  it("allows a self-update (excludeDocumentId matches the colliding row)", async () => {
    const { strapi } = makeFormStrapiMock([existing("contact-us", "theme-1", "form-self")]);

    await expect(
      assertUniqueThemeKey(strapi as never, { key: "contact-us", theme: "theme-1" }, "form-self")
    ).resolves.not.toThrow();
  });

  it("normalizes the GraphQL connect shape (data.theme.connect[0].documentId)", async () => {
    const { strapi, findMany } = makeFormStrapiMock([
      existing("contact-us", "theme-1", "form-existing"),
    ]);

    await expect(
      assertUniqueThemeKey(strapi as never, {
        key: "contact-us",
        theme: { connect: [{ documentId: "theme-1" }] },
      })
    ).rejects.toThrow(/already exists/i);

    // Both write shapes must produce the SAME parameterized theme filter.
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        filters: expect.objectContaining({
          key: { $eq: "contact-us" },
          theme: { documentId: { $eq: "theme-1" } },
        }),
      })
    );
  });

  it("no-ops when key is missing", async () => {
    const { strapi, findMany } = makeFormStrapiMock([existing("contact-us", "theme-1", "x")]);

    await expect(
      assertUniqueThemeKey(strapi as never, { theme: "theme-1" })
    ).resolves.not.toThrow();
    expect(findMany).not.toHaveBeenCalled();
  });

  it("no-ops when the theme relation is missing", async () => {
    const { strapi, findMany } = makeFormStrapiMock([existing("contact-us", "theme-1", "x")]);

    await expect(
      assertUniqueThemeKey(strapi as never, { key: "contact-us" })
    ).resolves.not.toThrow();
    expect(findMany).not.toHaveBeenCalled();
  });

  it("queries only published rows (drafts must not block a key)", async () => {
    const { strapi, findMany } = makeFormStrapiMock([]);

    await assertUniqueThemeKey(strapi as never, { key: "contact-us", theme: "theme-1" });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ status: "published" })
    );
  });
});
