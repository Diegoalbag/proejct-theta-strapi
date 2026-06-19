import { describe, expect, it, vi } from "vitest";
// Phase 6: the migration drops the legacy GLOBAL-unique index on
// page_templates.key (left over from `key` being a uid) so the multi-theme
// (theme,key) model — enforced by the lifecycle hook — is not blocked by a DB
// constraint. Idempotent + guarded; must never throw on boot.
import { dropPageTemplateKeyGlobalUnique } from "../page-template-key";

function strapiWithKnex(knex: any) {
  return { db: { connection: knex }, log: { info: vi.fn(), warn: vi.fn() } };
}

describe("dropPageTemplateKeyGlobalUnique", () => {
  it("no-ops (skipped) when there is no DB connection", async () => {
    const res = await dropPageTemplateKeyGlobalUnique({ db: {} });
    expect(res).toEqual({ dropped: [], skipped: true });
  });

  it("sqlite: drops only UNIQUE indexes that cover the key column", async () => {
    const dropped: string[] = [];
    const knex: any = {
      client: { config: { client: "better-sqlite3" } },
      raw: vi.fn(async (sql: string) => {
        if (sql.includes("index_list")) {
          return [
            { name: "page_templates_key_unique", unique: 1 },
            { name: "page_templates_name_idx", unique: 0 },
            { name: "page_templates_theme_unique", unique: 1 },
          ];
        }
        if (sql.includes("index_info('page_templates_key_unique')")) {
          return [{ name: "key" }];
        }
        if (sql.includes("index_info('page_templates_theme_unique')")) {
          return [{ name: "theme" }];
        }
        if (sql.startsWith("DROP INDEX")) {
          dropped.push(sql);
          return [];
        }
        return [];
      }),
    };

    const res = await dropPageTemplateKeyGlobalUnique(strapiWithKnex(knex));
    expect(res.dropped).toEqual(["page_templates_key_unique"]);
    expect(dropped).toHaveLength(1);
    expect(dropped[0]).toContain("page_templates_key_unique");
  });

  it("postgres: drops every unique index returned for the key column", async () => {
    const knex: any = {
      client: { config: { client: "postgres" } },
      raw: vi.fn(async (sql: string) => {
        if (sql.includes("pg_index")) {
          return { rows: [{ index_name: "page_templates_key_unique" }] };
        }
        return { rows: [] };
      }),
    };
    const res = await dropPageTemplateKeyGlobalUnique(strapiWithKnex(knex));
    expect(res.dropped).toEqual(["page_templates_key_unique"]);
  });

  it("never throws — a raw() failure is swallowed", async () => {
    const knex: any = {
      client: { config: { client: "postgres" } },
      raw: vi.fn(async () => {
        throw new Error("boom");
      }),
    };
    await expect(
      dropPageTemplateKeyGlobalUnique(strapiWithKnex(knex))
    ).resolves.toEqual({ dropped: [] });
  });
});
