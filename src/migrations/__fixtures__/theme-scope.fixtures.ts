/**
 * Shared synthetic fixtures + a fake-`strapi` factory for the Phase-5 Wave-0
 * RED suites (theme-scope migration + page-template lifecycle uniqueness).
 *
 * These objects contain NO real tenant data and NO secrets (T-05-01-01: accept).
 * They model the call surface used at `src/index.ts:114`
 * (`strapi.documents(uid).create/findMany/update(...)`) closely enough that the
 * pure migration/lifecycle logic — built in Plans 02/03 — can be exercised
 * without booting Strapi or touching a database.
 *
 * D-13 note: `Theme.isActive` is being DROPPED in this same release. The
 * `themesActiveOne` fixture deliberately keeps an `isActive` flag ONLY so the
 * tests can prove `resolveLiveTheme` IGNORES it (chooses most-recently-deployed
 * over the active-but-older theme).
 */

import { vi } from "vitest";

export interface ThemeFixture {
  documentId: string;
  name: string;
  /** D-13: present only to prove it is ignored. */
  isActive?: boolean;
  /** DEVID-04: dev-mode themes are NEVER live and must be dropped before the ladder. */
  isDev?: boolean;
  lastDeployedAt?: string | null;
  deploymentStatus?: string;
  builtAssetUrl?: string | null;
}

export interface TemplateFixture {
  documentId: string;
  name: string;
  key: string;
  isDefault?: boolean;
  theme?: { documentId: string } | null;
}

export interface SiteFixture {
  documentId: string;
  liveTheme?: { documentId: string } | null;
}

// --- Theme fixtures -------------------------------------------------------

/**
 * Multiple themes where the `isActive` theme is NOT the most-recently-deployed.
 * Used to PROVE resolveLiveTheme ignores isActive (D-13): it must return
 * `theme-recent` (most recent deploy), not `theme-active` (active but older).
 */
export const themesActiveOne: ThemeFixture[] = [
  {
    documentId: "theme-active",
    name: "Active But Older",
    isActive: true,
    lastDeployedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    documentId: "theme-recent",
    name: "Most Recently Deployed",
    isActive: false,
    lastDeployedAt: "2026-06-01T00:00:00.000Z",
  },
];

/** Exactly one theme — resolveLiveTheme returns it unconditionally. */
export const themesNoneOneOnly: ThemeFixture[] = [
  {
    documentId: "theme-solo",
    name: "Solo Theme",
    lastDeployedAt: null,
  },
];

/** Multiple themes, all deployed with distinct timestamps → most-recent wins. */
export const themesNoneMultipleDeployed: ThemeFixture[] = [
  {
    documentId: "theme-old",
    name: "Old Deploy",
    lastDeployedAt: "2026-02-01T00:00:00.000Z",
  },
  {
    documentId: "theme-new",
    name: "New Deploy",
    lastDeployedAt: "2026-05-15T00:00:00.000Z",
  },
];

/** Multiple themes, none deployed → ambiguous → resolveLiveTheme returns null. */
export const themesNoneMultipleAmbiguous: ThemeFixture[] = [
  { documentId: "theme-a", name: "Theme A", lastDeployedAt: null },
  { documentId: "theme-b", name: "Theme B", lastDeployedAt: null },
];

// --- isDev fixtures (DEVID-04) --------------------------------------------

/**
 * Exactly one theme, and it is a dev theme. A lone isDev theme must NEVER be
 * promoted to live — guards the `length === 1` branch of resolveLiveTheme so the
 * dev record can't slip past the ladder (DEVID-04 / RESEARCH Pitfall 5).
 * Expected: resolveLiveTheme(themesDevOnly) -> null.
 */
export const themesDevOnly: ThemeFixture[] = [
  {
    documentId: "theme-dev-solo",
    name: "Dev Solo",
    isDev: true,
    lastDeployedAt: "2026-06-10T00:00:00.000Z",
  },
];

/**
 * A dev theme deployed MOST recently alongside an earlier-deployed hosted theme.
 * The ladder must DROP the dev theme first and resolve to the hosted theme —
 * proving the most-recently-deployed pick skips isDev (DEVID-04).
 * Expected: resolveLiveTheme(themesHostedPlusDev) -> "theme-hosted".
 */
export const themesHostedPlusDev: ThemeFixture[] = [
  {
    documentId: "theme-dev-recent",
    name: "Dev Recent",
    isDev: true,
    lastDeployedAt: "2026-06-15T00:00:00.000Z",
  },
  {
    documentId: "theme-hosted",
    name: "Hosted Earlier",
    isDev: false,
    lastDeployedAt: "2026-06-01T00:00:00.000Z",
  },
];

// --- Template fixtures ----------------------------------------------------

/** Existing templates with NO theme relation — a fresh/legacy tenant. */
export const templatesWithoutTheme: TemplateFixture[] = [
  { documentId: "tmpl-home", name: "Homepage", key: "homepage", isDefault: true, theme: null },
  { documentId: "tmpl-about", name: "About", key: "about", theme: null },
];

/** Templates already bound to a theme — migration must no-op (idempotent). */
export const templatesWithTheme: TemplateFixture[] = [
  {
    documentId: "tmpl-home",
    name: "Homepage",
    key: "homepage",
    isDefault: true,
    theme: { documentId: "theme-solo" },
  },
];

// --- Site fixtures --------------------------------------------------------

export const siteWithoutLiveTheme: SiteFixture = {
  documentId: "site-1",
  liveTheme: null,
};

export const siteWithLiveTheme: SiteFixture = {
  documentId: "site-1",
  liveTheme: { documentId: "theme-solo" },
};

// --- Fake strapi factory --------------------------------------------------

export interface StrapiMockSeed {
  /** Rows returned by `documents('api::theme.theme').findMany()`. */
  themes?: ThemeFixture[];
  /** Rows returned by `documents('api::page-template.page-template').findMany()`. */
  templates?: TemplateFixture[];
  /** Row returned by `documents('api::site.site').findMany()` / first(). */
  site?: SiteFixture | null;
}

/**
 * A fake `strapi` whose `documents(uid)` returns chainable findMany/update/create
 * spies driven by the injected fixture arrays. Each spy is a `vi.fn` so callers
 * can assert call counts (e.g. migration idempotency → zero update calls) and
 * inspect the args (e.g. the (theme,key) filter passed to findMany).
 *
 * `findMany` honors a `limit` and a small subset of relation filters used by the
 * idempotency guard and the lifecycle uniqueness check:
 *   - templates: `theme.documentId.$notNull` (idempotency guard)
 *   - templates: `key.$eq` + `theme.documentId.$eq` (uniqueness check)
 */
export function makeStrapiMock(seed: StrapiMockSeed = {}) {
  const themes = seed.themes ?? [];
  const templates = seed.templates ?? [];
  const site = seed.site ?? null;

  const themeFindMany = vi.fn(async () => themes);

  const templateFindMany = vi.fn(async (args?: any) => {
    const filters = args?.filters ?? {};
    let rows = [...templates];

    // Idempotency guard: theme.documentId.$notNull
    if (filters?.theme?.documentId?.$notNull) {
      rows = rows.filter((t) => t.theme?.documentId);
    }
    // Uniqueness check: key.$eq + theme.documentId.$eq
    if (filters?.key?.$eq !== undefined) {
      rows = rows.filter((t) => t.key === filters.key.$eq);
    }
    if (filters?.theme?.documentId?.$eq !== undefined) {
      rows = rows.filter((t) => t.theme?.documentId === filters.theme.documentId.$eq);
    }

    if (typeof args?.limit === "number") rows = rows.slice(0, args.limit);
    return rows;
  });
  const templateUpdate = vi.fn(async (args?: any) => ({ documentId: args?.documentId }));

  const siteFindMany = vi.fn(async () => (site ? [site] : []));
  const siteUpdate = vi.fn(async (args?: any) => ({ ...(site ?? {}), ...args?.data }));

  const documents = vi.fn((uid: string) => {
    if (uid === "api::theme.theme") {
      return { findMany: themeFindMany };
    }
    if (uid === "api::page-template.page-template") {
      return { findMany: templateFindMany, update: templateUpdate };
    }
    if (uid === "api::site.site") {
      return { findMany: siteFindMany, update: siteUpdate };
    }
    throw new Error(`makeStrapiMock: unexpected uid "${uid}"`);
  });

  const strapi = {
    documents,
    log: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
  };

  return {
    strapi,
    spies: {
      themeFindMany,
      templateFindMany,
      templateUpdate,
      siteFindMany,
      siteUpdate,
      documents,
    },
  };
}
