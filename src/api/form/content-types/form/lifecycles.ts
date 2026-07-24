/**
 * Form lifecycle hooks — scoped (theme, key) uniqueness.
 *
 * Mirrors the PageTemplate hook (src/api/page-template/content-types/page-template/
 * lifecycles.ts) and exists for the same two Strapi v5 reasons:
 *
 *   1. `unique: true` is GLOBAL per content-type at the DB level and cannot be
 *      scoped to a relation, so it can't express "unique key WITHIN a theme".
 *   2. With `draftAndPublish`, Strapi skips its own unique checks on drafts.
 *
 * So uniqueness is enforced here, on EVERY write (beforeCreate AND beforeUpdate),
 * not by a schema `unique` flag. `key` is deliberately a plain `string` and not a
 * `uid` — a `uid` would create exactly the global unique index that had to be
 * dropped from page_templates.key by a migration.
 *
 * Why it matters for forms specifically: the key is what the theme's form section
 * and the `{{form:key}}` richtext token resolve against, so a duplicate key within
 * a theme would make embed resolution ambiguous.
 *
 * Security: only parameterized document-service filters are used — user-supplied
 * `key`/theme id are never string-concatenated into a query.
 * Tenant isolation: the hook runs inside each tenant's own Strapi instance
 * (separate DB) and filters by the write's OWN theme id.
 */

type RelationConnect = { connect?: Array<{ documentId?: string }> };
type FormWriteData = {
  key?: string;
  theme?: string | RelationConnect | null;
};

/** Normalize the theme documentId from both write shapes (GraphQL connect or direct id). */
function resolveThemeId(theme: FormWriteData["theme"]): string | undefined {
  if (theme == null) return undefined;
  if (typeof theme === "string") return theme;
  return theme.connect?.[0]?.documentId;
}

/**
 * Reject a write whose (theme, key) collides with an existing published form under
 * the SAME theme. No-op when there is nothing to check (missing key or theme).
 */
export async function assertUniqueThemeKey(
  strapi: any,
  data: FormWriteData,
  excludeDocumentId?: string
): Promise<void> {
  const themeId = resolveThemeId(data?.theme);
  if (!data?.key || !themeId) return; // nothing to check

  const dupes = await strapi.documents("api::form.form").findMany({
    filters: {
      key: { $eq: data.key },
      theme: { documentId: { $eq: themeId } },
    },
    status: "published",
  });

  const collision = (dupes ?? []).find(
    (d: { documentId?: string }) => d.documentId !== excludeDocumentId
  );

  if (collision) {
    throw new Error(`Form key "${data.key}" already exists for this theme`);
  }
}

export default {
  async beforeCreate(event: any) {
    await assertUniqueThemeKey(strapi, event.params.data);
  },
  async beforeUpdate(event: any) {
    await assertUniqueThemeKey(strapi, event.params.data, event.params.where?.documentId);
  },
};
