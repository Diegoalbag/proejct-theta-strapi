/**
 * Phase 6 — drop the legacy GLOBAL-unique index on `page_templates.key`.
 *
 * `key` was declared `type: "uid"`, which gives Strapi an intrinsic GLOBAL unique
 * index at the DB level. That contradicts the multi-theme model (MT-01): two
 * themes must each own a `homepage` template, with uniqueness scoped to
 * `(theme, key)` and enforced by the page-template lifecycle hook
 * (`assertUniqueThemeKey`). The global index made the SECOND theme's `homepage`
 * impossible ("This attribute must be unique"), which broke dev-theme homepage
 * provisioning.
 *
 * `key` is now `type: "string"`. Strapi's schema sync MAY drop the old unique
 * index on boot, but does not reliably do so for a uid→string change — so this
 * idempotent bootstrap migration removes any remaining UNIQUE index that covers
 * the `key` column. Safe to run every boot (DROP ... IF EXISTS / no-op when gone)
 * and across Postgres (deployed tenants) and SQLite (local dev).
 *
 * The composite `(theme, key)` uniqueness is unaffected — it lives entirely in the
 * lifecycle hook, never in a DB index.
 */

export async function dropPageTemplateKeyGlobalUnique(strapi: any): Promise<{
  dropped: string[];
  skipped?: boolean;
}> {
  const knex = strapi?.db?.connection;
  if (!knex) return { dropped: [], skipped: true };

  const client: string = String(knex.client?.config?.client ?? '');
  const dropped: string[] = [];

  try {
    if (client.includes('pg') || client.includes('postgres')) {
      // Find every UNIQUE index on page_templates that covers the `key` column.
      const res = await knex.raw(
        `SELECT i.relname AS index_name
           FROM pg_class t
           JOIN pg_index ix ON ix.indrelid = t.oid
           JOIN pg_class i ON i.oid = ix.indexrelid
           JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
          WHERE t.relname = 'page_templates'
            AND a.attname = 'key'
            AND ix.indisunique = true`,
      );
      for (const row of res?.rows ?? []) {
        await knex.raw(`DROP INDEX IF EXISTS "${row.index_name}"`);
        dropped.push(row.index_name);
      }
    } else if (client.includes('sqlite')) {
      const idxList = await knex.raw(`PRAGMA index_list('page_templates')`);
      const rows: any[] = Array.isArray(idxList) ? idxList : (idxList?.rows ?? idxList ?? []);
      for (const idx of rows) {
        if (!idx?.unique) continue;
        const info = await knex.raw(`PRAGMA index_info('${idx.name}')`);
        const cols: any[] = Array.isArray(info) ? info : (info?.rows ?? info ?? []);
        if (cols.some((c) => c?.name === 'key')) {
          await knex.raw(`DROP INDEX IF EXISTS "${idx.name}"`);
          dropped.push(idx.name);
        }
      }
    }

    if (dropped.length > 0) {
      strapi.log?.info?.(
        `[page-template-key] dropped legacy global-unique index(es) on key: ${dropped.join(', ')}`,
      );
    }
    return { dropped };
  } catch (err) {
    // Never fail boot over an index cleanup — the lifecycle hook still enforces
    // (theme,key) uniqueness; a lingering global index would only over-constrain.
    strapi.log?.warn?.(`[page-template-key] index drop skipped: ${err}`);
    return { dropped };
  }
}
