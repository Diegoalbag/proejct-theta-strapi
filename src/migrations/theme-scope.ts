/**
 * Phase 5 — theme-scope bootstrap migration (MT-07, D-08/D-09/D-13).
 *
 * Two exports:
 *   - `resolveLiveTheme(themes)` — PURE: resolves the live theme via the D-09
 *     fallback ladder. The active-flag branch was removed (D-13); resolution is
 *     deploy-timestamp driven only.
 *       1. exactly one theme            -> that theme
 *       2. multiple, deployed ones      -> the single most-recently-deployed
 *                                          (by `lastDeployedAt`)
 *       3. ambiguous (multiple, none deployed, or no clear most-recent winner)
 *                                          -> null  (does NOT throw)
 *   - `runThemeScopeMigration(strapi)` — IDEMPOTENT per-tenant backfill wired
 *     into bootstrap(). Guards on an already-migrated tenant, resolves the live
 *     theme, backfills `theme` on every existing PageTemplate (scalar relation
 *     ONLY — never rewrites the `sections` repeatable component), sets
 *     `Site.liveTheme`, and defensively folds any non-empty legacy singleton
 *     `theme { sections }` into the live theme's homepage template (expected
 *     no-op per RESEARCH Finding 2). Runs every boot — short-circuits if already
 *     migrated so re-runs never re-point a tenant.
 */

interface ThemeLike {
  documentId: string;
  name?: string;
  lastDeployedAt?: string | null;
  // DEVID-04: dev-mode themes are NEVER live and are filtered out before the
  // D-09 ladder (resolveLiveTheme). The deployed site reads Site.liveTheme only,
  // so a dev theme can never be resolved as live, even on a single-theme tenant.
  isDev?: boolean;
  // NOTE: the legacy active-flag is intentionally NOT referenced (D-13).
}

interface TemplateLike {
  documentId: string;
  name?: string;
  key?: string;
  theme?: { documentId: string } | null;
  sections?: unknown[];
}

/**
 * PURE D-09 ladder. The legacy active-flag branch is removed (D-13).
 */
export function resolveLiveTheme<T extends ThemeLike>(themes: T[]): T | null {
  // DEVID-04 / RESEARCH Pitfall 5: drop dev themes BEFORE any length/deploy
  // branch so a lone dev theme can never slip through the `length === 1` branch.
  // Elevation-of-Privilege mitigation (T-06-01) — the entire ladder runs over
  // `hosted`, never the raw `themes`.
  const hosted = (themes ?? []).filter((t) => !t.isDev);
  if (hosted.length === 0) return null;

  // Branch 1: exactly one hosted theme — unconditionally live.
  if (hosted.length === 1) return hosted[0];

  // Branch 2: among hosted themes that have actually been deployed, pick the
  // single most-recently-deployed by `lastDeployedAt`. Deploy timestamp only (D-13).
  const deployed = hosted.filter((t) => Boolean(t.lastDeployedAt));
  if (deployed.length === 0) return null; // none deployed -> ambiguous

  const sorted = [...deployed].sort(
    (a, b) =>
      new Date(b.lastDeployedAt as string).getTime() -
      new Date(a.lastDeployedAt as string).getTime(),
  );

  // Guard against an ambiguous tie for the most-recent slot (two themes share
  // the exact same newest timestamp -> no clear winner -> null).
  if (sorted.length > 1) {
    const top = new Date(sorted[0].lastDeployedAt as string).getTime();
    const second = new Date(sorted[1].lastDeployedAt as string).getTime();
    if (top === second) return null;
  }

  return sorted[0];
}

interface MigrationResult {
  skipped?: boolean;
  ambiguous?: boolean;
  migrated?: boolean;
  liveTheme?: string;
  templates?: number;
}

/**
 * IDEMPOTENT per-tenant backfill. Wired into bootstrap() — runs every boot.
 */
export async function runThemeScopeMigration(strapi: any): Promise<MigrationResult> {
  try {
    // (1) IDEMPOTENCY GUARD — if ANY template already carries a `theme`, the
    // tenant is migrated; no-op so re-runs never re-point data (D-08).
    const alreadyScoped: TemplateLike[] = await strapi
      .documents('api::page-template.page-template')
      .findMany({
        filters: { theme: { documentId: { $notNull: true } } },
        limit: 1,
        status: 'published',
      });

    if (Array.isArray(alreadyScoped) && alreadyScoped.length > 0) {
      return { skipped: true };
    }

    // (2) Resolve the live theme from published themes via the D-09 ladder.
    const themes: ThemeLike[] = await strapi
      .documents('api::theme.theme')
      .findMany({ status: 'published' });

    const liveTheme = resolveLiveTheme(themes ?? []);

    if (!liveTheme) {
      strapi.log.warn(
        '[theme-scope] Ambiguous live theme — leaving Site.liveTheme unset (D-09)',
      );
      return { ambiguous: true };
    }

    // (3) Backfill `theme` on every published template. Set ONLY the scalar
    // relation — do NOT pass `sections` (avoids the Strapi v5 repeatable-
    // component rewrite caveat / RESEARCH anti-pattern).
    const templates: TemplateLike[] = await strapi
      .documents('api::page-template.page-template')
      .findMany({ status: 'published' });

    for (const tmpl of templates ?? []) {
      await strapi.documents('api::page-template.page-template').update({
        documentId: tmpl.documentId,
        data: { theme: liveTheme.documentId },
        status: 'published',
      });
    }

    // (4) Point Site.liveTheme at the resolved theme.
    await strapi.documents('api::site.site').update({
      data: { liveTheme: liveTheme.documentId },
      status: 'published',
    });

    // (5) DEFENSIVE legacy singleton fold (expected no-op per Finding 2). The
    // legacy singleton's `sections` read is dead — live config already lives on
    // PageTemplate.sections. If a non-empty legacy singleton `theme { sections }`
    // somehow exists AND the live theme's homepage template is empty, fold it in;
    // otherwise no-op. Fully guarded so it never throws on a normal tenant.
    try {
      const legacy: { sections?: unknown[] } | undefined = (liveTheme as any)?.sections
        ? (liveTheme as any)
        : undefined;
      const legacySections = legacy?.sections;
      if (Array.isArray(legacySections) && legacySections.length > 0) {
        const homepage = (templates ?? []).find(
          (t) => t.key === 'homepage' || t.name === 'Homepage',
        );
        const homepageEmpty =
          homepage &&
          (!Array.isArray(homepage.sections) || homepage.sections.length === 0);
        if (homepage && homepageEmpty) {
          await strapi.documents('api::page-template.page-template').update({
            documentId: homepage.documentId,
            data: { sections: legacySections },
            status: 'published',
          });
        }
      }
    } catch (foldErr) {
      console.error('[theme-scope] singleton fold (defensive) skipped:', foldErr);
    }

    return {
      migrated: true,
      liveTheme: liveTheme.documentId,
      templates: (templates ?? []).length,
    };
  } catch (err) {
    console.error('[theme-scope] migration failed:', err);
    return {};
  }
}
