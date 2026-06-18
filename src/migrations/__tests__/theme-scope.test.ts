import { describe, expect, it } from "vitest";
// RED (Phase 5, Wave 0): `../theme-scope` is built in Plan 03 (MT-07, D-08/D-09/D-13).
// This suite MUST fail now (module absent) so the live-theme fallback ladder and
// the migration idempotency guarantee each have an automated gate BEFORE the
// implementation lands. The RED state IS the gate for Plan 03.
//
// Contract under test:
//   resolveLiveTheme(themes):
//     - exactly one theme           -> that theme
//     - multiple, some deployed     -> most-recently-deployed
//     - multiple, none deployed     -> null (ambiguous, does NOT throw) [D-09]
//     - MUST NOT read isActive: given an active-but-older theme alongside a
//       most-recently-deployed one, returns the most-recently-deployed [D-13].
//   runThemeScopeMigration(strapi):
//     - any template already has `theme` set -> { skipped: true }, zero updates
//     - fresh tenant -> backfills `theme` on every template AND sets
//       Site.liveTheme to the resolved theme's documentId.
import { resolveLiveTheme, runThemeScopeMigration } from "../theme-scope";
import {
  makeStrapiMock,
  siteWithoutLiveTheme,
  templatesWithTheme,
  templatesWithoutTheme,
  themesActiveOne,
  themesNoneMultipleAmbiguous,
  themesNoneMultipleDeployed,
  themesNoneOneOnly,
} from "../__fixtures__/theme-scope.fixtures";

describe("resolveLiveTheme — D-09 fallback ladder (no isActive, D-13)", () => {
  it("returns the only theme when exactly one exists", () => {
    const result = resolveLiveTheme(themesNoneOneOnly);
    expect(result?.documentId).toBe("theme-solo");
  });

  it("returns the most-recently-deployed when multiple are deployed", () => {
    const result = resolveLiveTheme(themesNoneMultipleDeployed);
    expect(result?.documentId).toBe("theme-new");
  });

  it("returns null (does NOT throw) when ambiguous: multiple, none deployed", () => {
    let result: ReturnType<typeof resolveLiveTheme> | undefined;
    expect(() => {
      result = resolveLiveTheme(themesNoneMultipleAmbiguous);
    }).not.toThrow();
    expect(result).toBeNull();
  });

  it("IGNORES isActive (D-13): picks most-recently-deployed over active-but-older", () => {
    // themesActiveOne: `theme-active` is isActive:true but deployed 2026-01-01;
    // `theme-recent` is isActive:false but deployed 2026-06-01. The correct
    // result is `theme-recent` — proving the isActive branch is REMOVED.
    const result = resolveLiveTheme(themesActiveOne);
    expect(result?.documentId).toBe("theme-recent");
  });
});

describe("runThemeScopeMigration — idempotency + backfill (MT-07)", () => {
  it("is idempotent: when any template already has a theme, returns { skipped: true } and issues zero updates", async () => {
    const { strapi, spies } = makeStrapiMock({
      themes: themesNoneOneOnly,
      templates: templatesWithTheme,
      site: siteWithoutLiveTheme,
    });

    const result = await runThemeScopeMigration(strapi as never);

    expect(result).toMatchObject({ skipped: true });
    expect(spies.templateUpdate).not.toHaveBeenCalled();
    expect(spies.siteUpdate).not.toHaveBeenCalled();
  });

  it("on a fresh tenant: backfills theme on every template and sets Site.liveTheme to the resolved theme", async () => {
    const { strapi, spies } = makeStrapiMock({
      themes: themesNoneOneOnly,
      templates: templatesWithoutTheme,
      site: siteWithoutLiveTheme,
    });

    const result = await runThemeScopeMigration(strapi as never);

    expect(result).toMatchObject({ migrated: true, liveTheme: "theme-solo" });
    // one update per template
    expect(spies.templateUpdate).toHaveBeenCalledTimes(templatesWithoutTheme.length);
    // every update binds the resolved theme
    for (const call of spies.templateUpdate.mock.calls) {
      expect((call[0] as any)?.data?.theme).toBe("theme-solo");
    }
    // Site.liveTheme set to the resolved theme's documentId
    expect(spies.siteUpdate).toHaveBeenCalledTimes(1);
    expect((spies.siteUpdate.mock.calls[0][0] as any)?.data?.liveTheme).toBe("theme-solo");
  });
});
