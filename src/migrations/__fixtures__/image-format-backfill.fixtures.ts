/**
 * Shared synthetic fixtures + a fake-`strapi` factory for the Phase 11 Plan 07
 * `image-format-backfill` migration test suite (D-02, D-03).
 *
 * Mirrors `theme-scope.fixtures.ts`'s plain-object-mock style (NO `vi.mock()`):
 * `makeUploadStrapiMock(seed)` returns `{ strapi, spies }` where
 * `strapi.db.query('plugin::upload.file')` exposes `findMany`/`update` spies
 * over the seeded `files` array, and `strapi.plugin('upload').service('upload')`
 * exposes `getSettings`/`setSettings` spies seeded from `seed.settings`.
 * `strapi.plugin('upload').service('image-manipulation')` exposes a
 * `generateResponsiveFormats` spy — by default it returns a synthetic `webp`
 * format entry for whatever file it's given, but a test can inject its own
 * `generateResponsiveFormatsImpl` to simulate a per-file conversion failure
 * (Test 3 — one bad file must never abort the rest of the batch).
 */

import { vi } from "vitest";

export interface FormatEntry {
  url?: string;
  [key: string]: unknown;
}

export interface FileFixture {
  id: number;
  name: string;
  hash: string;
  mime: string;
  width?: number;
  height?: number;
  formats?: Record<string, FormatEntry>;
}

// --- File fixtures ---------------------------------------------------------

/**
 * Every file already carries `formats.webp` — the migration must be a no-op
 * ({ skipped: true }, zero update calls) against this set (Test 1).
 */
export const filesAllConverted: FileFixture[] = [
  {
    id: 1,
    name: "hero.png",
    hash: "hero_abc123",
    mime: "image/png",
    width: 1200,
    height: 800,
    formats: {
      thumbnail: { url: "/uploads/thumbnail_hero.png" },
      small: { url: "/uploads/small_hero.png" },
      webp: { url: "/uploads/hero.webp" },
    },
  },
  {
    id: 2,
    name: "logo.png",
    hash: "logo_def456",
    mime: "image/png",
    width: 400,
    height: 400,
    formats: {
      thumbnail: { url: "/uploads/thumbnail_logo.png" },
      webp: { url: "/uploads/logo.webp" },
    },
  },
];

/**
 * A mix of files with and without `formats.webp` (Test 2/3): ids 10 and 12
 * are missing `webp` and carry pre-existing thumbnail/small/medium/large
 * entries (proves the read-merge-write never clobbers them); id 11 already
 * has `webp` and must be left untouched (no update call for it).
 */
export const filesNeedingBackfill: FileFixture[] = [
  {
    id: 10,
    name: "hero.png",
    hash: "hero_ghi789",
    mime: "image/png",
    width: 1200,
    height: 800,
    formats: {
      thumbnail: { url: "/uploads/thumbnail_hero.png" },
      small: { url: "/uploads/small_hero.png" },
    },
  },
  {
    id: 11,
    name: "logo.png",
    hash: "logo_jkl012",
    mime: "image/png",
    width: 400,
    height: 400,
    formats: {
      webp: { url: "/uploads/logo.webp" },
    },
  },
  {
    id: 12,
    name: "banner.jpg",
    hash: "banner_mno345",
    mime: "image/jpeg",
    width: 1600,
    height: 500,
    formats: {
      thumbnail: { url: "/uploads/thumbnail_banner.jpg" },
      medium: { url: "/uploads/medium_banner.jpg" },
      large: { url: "/uploads/large_banner.jpg" },
    },
  },
];

// --- Fake strapi factory -----------------------------------------------------

export interface UploadStrapiMockSeed {
  /** Rows returned by `strapi.db.query('plugin::upload.file').findMany()`. */
  files: FileFixture[];
  /** Seed for `strapi.plugin('upload').service('upload').getSettings()`. */
  settings?: Record<string, unknown>;
  /**
   * Optional override for `image-manipulation.generateResponsiveFormats` — by
   * default returns a synthetic `{ key: 'webp', file }` entry for every file.
   * Inject a per-file-throwing implementation to simulate Test 3's corrupt file.
   */
  generateResponsiveFormatsImpl?: (
    file: FileFixture,
  ) => Promise<Array<{ key: string; file: unknown }>>;
}

export function makeUploadStrapiMock(seed: UploadStrapiMockSeed) {
  // Deep-ish copy so mutations from `update` never leak across test cases.
  const files: FileFixture[] = seed.files.map((f) => ({
    ...f,
    formats: { ...(f.formats ?? {}) },
  }));
  const settings: Record<string, unknown> = { ...(seed.settings ?? {}) };

  const findMany = vi.fn(async (_args?: any) => files);
  const update = vi.fn(async (args?: any) => {
    const target = files.find((f) => f.id === args?.where?.id);
    if (target) {
      target.formats = args?.data?.formats;
    }
    return target;
  });

  const getSettings = vi.fn(async () => settings);
  const setSettings = vi.fn(async (value: Record<string, unknown>) => {
    Object.assign(settings, value);
    return settings;
  });

  const defaultGenerateResponsiveFormats = async (file: FileFixture) => [
    { key: "webp", file: { url: `/uploads/${file.hash}.webp` } },
  ];
  const generateResponsiveFormats = vi.fn(
    seed.generateResponsiveFormatsImpl ?? defaultGenerateResponsiveFormats,
  );

  const strapi = {
    db: {
      query: vi.fn((uid: string) => {
        if (uid === "plugin::upload.file") {
          return { findMany, update };
        }
        throw new Error(`makeUploadStrapiMock: unexpected uid "${uid}"`);
      }),
    },
    plugin: vi.fn((name: string) => {
      if (name !== "upload") {
        throw new Error(`makeUploadStrapiMock: unexpected plugin "${name}"`);
      }
      return {
        service: vi.fn((serviceName: string) => {
          if (serviceName === "upload") {
            return { getSettings, setSettings };
          }
          if (serviceName === "image-manipulation") {
            return { generateResponsiveFormats };
          }
          throw new Error(`makeUploadStrapiMock: unexpected service "${serviceName}"`);
        }),
      };
    }),
  };

  return {
    strapi,
    spies: {
      findMany,
      update,
      getSettings,
      setSettings,
      generateResponsiveFormats,
    },
  };
}
