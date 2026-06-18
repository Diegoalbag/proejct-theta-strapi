/**
 * PageTemplate lifecycle hooks — scoped (theme, key) uniqueness (MT-01, D-00a).
 *
 * Strapi v5 `unique: true` is GLOBAL per content-type at the DB level and cannot
 * scope to a relation, and with `draftAndPublish` Strapi skips its own unique
 * checks on drafts (Pitfall 2). So `(theme, key)` uniqueness is enforced here,
 * on EVERY write (beforeCreate AND beforeUpdate), not by a schema `unique` flag.
 *
 * Contract (driven by the Plan-01 RED test):
 *   assertUniqueThemeKey(strapi, data, excludeDocumentId?)
 *     - throws when `key` already exists under the SAME theme
 *     - allows the same `key` under a DIFFERENT theme (cross-theme coexistence)
 *     - allows a self-update (excludeDocumentId matches the colliding row)
 *     - normalizes BOTH relation shapes:
 *         data.theme.connect[0].documentId (GraphQL) and data.theme (direct id)
 *
 * Security (T-05-02-01): only parameterized document-service filters are used —
 * user-supplied `key`/theme id are never string-concatenated into a query.
 * Tenant isolation (T-05-02-02): the hook runs inside each tenant's own Strapi
 * instance (separate DB) and filters by the write's OWN theme id.
 */

type RelationConnect = { connect?: Array<{ documentId?: string }> };
type TemplateWriteData = {
  key?: string;
  theme?: string | RelationConnect | null;
};

/** Normalize the theme documentId from both write shapes (GraphQL connect or direct id). */
function resolveThemeId(theme: TemplateWriteData["theme"]): string | undefined {
  if (theme == null) return undefined;
  if (typeof theme === "string") return theme;
  return theme.connect?.[0]?.documentId;
}

/**
 * Reject a write whose (theme, key) collides with an existing published template
 * under the SAME theme. No-op when there is nothing to check (missing key or theme).
 */
export async function assertUniqueThemeKey(
  strapi: any,
  data: TemplateWriteData,
  excludeDocumentId?: string
): Promise<void> {
  const themeId = resolveThemeId(data?.theme);
  if (!data?.key || !themeId) return; // nothing to check

  const dupes = await strapi.documents("api::page-template.page-template").findMany({
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
    throw new Error(`PageTemplate key "${data.key}" already exists for this theme`);
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
