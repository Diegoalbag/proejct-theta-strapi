import { describe, expect, it } from "vitest";
// RED (Phase 5, Wave 0): `../lifecycles` is built in Plan 02 (MT-01, D-00a, Pitfall 2).
// This suite MUST fail now (module absent) so scoped (theme,key) uniqueness has
// an automated gate BEFORE the lifecycle hook lands. The RED state IS the gate
// for Plan 02.
//
// Contract under test — assertUniqueThemeKey(strapi, data, excludeDocumentId?):
//   - throws when a template with the same `key` already exists under the SAME theme
//   - does NOT throw when the same `key` exists only under a DIFFERENT theme
//     (cross-theme coexistence is allowed — Strapi `unique:true` can't scope this)
//   - does NOT throw when excludeDocumentId matches the colliding row (self-update)
//   - normalizes BOTH relation shapes to the same theme filter:
//       data.theme.connect[0].documentId (GraphQL) and data.theme (direct id)
//
// Note: Strapi `unique: true` is global per content-type and cannot scope to a
// relation; with draftAndPublish, Strapi skips its own unique checks on drafts.
// The lifecycle hook is the only reliable gate (Pitfall 2).
import { assertUniqueThemeKey } from "../lifecycles";
import {
  makeStrapiMock,
  type TemplateFixture,
} from "../../../../../migrations/__fixtures__/theme-scope.fixtures";

function existing(key: string, themeId: string, documentId: string): TemplateFixture {
  return { documentId, name: key, key, theme: { documentId: themeId } };
}

describe("assertUniqueThemeKey — scoped (theme,key) uniqueness (MT-01)", () => {
  it("throws when the same key exists under the SAME theme (collision)", async () => {
    const { strapi } = makeStrapiMock({
      templates: [existing("homepage", "theme-1", "tmpl-existing")],
    });

    await expect(
      assertUniqueThemeKey(strapi as never, { key: "homepage", theme: "theme-1" })
    ).rejects.toThrow();
  });

  it("does NOT throw when the same key exists only under a DIFFERENT theme (cross-theme allowed)", async () => {
    const { strapi } = makeStrapiMock({
      templates: [existing("homepage", "theme-OTHER", "tmpl-existing")],
    });

    await expect(
      assertUniqueThemeKey(strapi as never, { key: "homepage", theme: "theme-1" })
    ).resolves.not.toThrow();
  });

  it("does NOT throw when excludeDocumentId matches the colliding row (self-update)", async () => {
    const { strapi } = makeStrapiMock({
      templates: [existing("homepage", "theme-1", "tmpl-self")],
    });

    await expect(
      assertUniqueThemeKey(strapi as never, { key: "homepage", theme: "theme-1" }, "tmpl-self")
    ).resolves.not.toThrow();
  });

  it("normalizes the GraphQL connect shape (data.theme.connect[0].documentId)", async () => {
    const { strapi } = makeStrapiMock({
      templates: [existing("homepage", "theme-1", "tmpl-existing")],
    });

    await expect(
      assertUniqueThemeKey(strapi as never, {
        key: "homepage",
        theme: { connect: [{ documentId: "theme-1" }] },
      })
    ).rejects.toThrow();
  });

  it("normalizes the direct-id shape (data.theme) to the same theme filter", async () => {
    const { strapi, spies } = makeStrapiMock({
      templates: [existing("homepage", "theme-1", "tmpl-existing")],
    });

    await expect(
      assertUniqueThemeKey(strapi as never, { key: "homepage", theme: "theme-1" })
    ).rejects.toThrow();

    // both shapes must drive a findMany filtered to theme-1
    const filterCall = spies.templateFindMany.mock.calls.find(
      (c) => (c[0] as any)?.filters?.theme?.documentId?.$eq === "theme-1"
    );
    expect(filterCall).toBeTruthy();
  });
});
