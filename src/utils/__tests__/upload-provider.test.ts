/**
 * The upload provider decides whether tenant media survives a redeploy.
 *
 * Two failure directions matter and they pull against each other:
 *   - engaging S3 when it is not properly configured takes the CMS down at boot
 *     for local dev, CI, and every unprovisioned tenant;
 *   - NOT engaging it when it is configured silently reinstates the bug that
 *     destroyed all 12 of the live tenant's images.
 *
 * So the switch itself is what's under test, not the AWS SDK.
 */
import { describe, expect, it, vi, afterEach } from "vitest";
import { buildUploadConfig } from "../upload-provider";

/** Mimics Strapi's `env(key, default)` over a plain object. */
const envFrom =
  (vars: Record<string, string>) =>
  (key: string, def = ""): string =>
    Object.prototype.hasOwnProperty.call(vars, key) ? vars[key] : def;

const FULL = {
  S3_BUCKET: "tenant-media",
  S3_ACCESS_KEY_ID: "AKIAEXAMPLE",
  S3_SECRET_ACCESS_KEY: "secret",
};

afterEach(() => vi.restoreAllMocks());

describe("buildUploadConfig — staying on local disk", () => {
  it("returns an empty config when no bucket is named", () => {
    // Local dev and CI have no credentials and must boot normally.
    expect(buildUploadConfig(envFrom({}))).toEqual({});
  });

  it("treats a whitespace-only bucket as absent", () => {
    expect(buildUploadConfig(envFrom({ ...FULL, S3_BUCKET: "   " }))).toEqual({});
  });

  it("falls back to local disk, loudly, when a bucket is named without credentials", () => {
    // A half-configured tenant is a misconfiguration, not a request for an
    // anonymous bucket. Keeping the CMS up beats failing closed here, but it
    // must not be silent — silence is how the original bug survived for weeks.
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const result = buildUploadConfig(envFrom({ S3_BUCKET: "tenant-media" }));
    expect(result).toEqual({});
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toContain("will NOT survive redeploys");
  });

  it("also falls back when only one half of the credential pair is present", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(
      buildUploadConfig(envFrom({ S3_BUCKET: "b", S3_ACCESS_KEY_ID: "k" })),
    ).toEqual({});
    expect(
      buildUploadConfig(envFrom({ S3_BUCKET: "b", S3_SECRET_ACCESS_KEY: "s" })),
    ).toEqual({});
  });
});

describe("buildUploadConfig — engaging S3", () => {
  it("selects the aws-s3 provider and passes the bucket through", () => {
    const c = buildUploadConfig(envFrom(FULL));
    expect(c.provider).toBe("aws-s3");
    const s3 = (c.providerOptions as any).s3Options;
    expect(s3.params.Bucket).toBe("tenant-media");
    expect(s3.credentials).toEqual({
      accessKeyId: "AKIAEXAMPLE",
      secretAccessKey: "secret",
    });
  });

  it("marks objects public-read on both upload paths", () => {
    // The theme-site and customizer load these URLs directly from the browser,
    // cross-origin and unsigned. Private objects would render as broken images —
    // the same visible symptom this change exists to end.
    const c = buildUploadConfig(envFrom(FULL));
    expect((c.actionOptions as any).upload.ACL).toBe("public-read");
    expect((c.actionOptions as any).uploadStream.ACL).toBe("public-read");
  });

  it("defaults region to auto, which is what R2 and Railway buckets expect", () => {
    const c = buildUploadConfig(envFrom(FULL));
    expect((c.providerOptions as any).s3Options.region).toBe("auto");
  });

  it("enables path-style addressing when a custom endpoint is set", () => {
    // Required by most S3-compatible providers; wrong to force on real AWS.
    const withEp = buildUploadConfig(
      envFrom({ ...FULL, S3_ENDPOINT: "https://x.r2.cloudflarestorage.com" }),
    );
    const s3 = (withEp.providerOptions as any).s3Options;
    expect(s3.endpoint).toBe("https://x.r2.cloudflarestorage.com");
    expect(s3.forcePathStyle).toBe(true);

    const noEp = buildUploadConfig(envFrom(FULL));
    expect((noEp.providerOptions as any).s3Options.endpoint).toBeUndefined();
    expect((noEp.providerOptions as any).s3Options.forcePathStyle).toBe(false);
  });

  it("lets an operator force path-style off explicitly", () => {
    const c = buildUploadConfig(
      envFrom({ ...FULL, S3_ENDPOINT: "https://x", S3_FORCE_PATH_STYLE: "false" }),
    );
    expect((c.providerOptions as any).s3Options.forcePathStyle).toBe(false);
  });

  it("omits baseUrl and rootPath entirely rather than passing empty strings", () => {
    // An empty baseUrl would compose into media URLs like "/uploads/x.png"
    // against the wrong origin; absent means "use the bucket's own URL".
    const c = buildUploadConfig(envFrom(FULL));
    expect("baseUrl" in (c.providerOptions as any)).toBe(false);
    expect("rootPath" in (c.providerOptions as any)).toBe(false);
  });

  it("passes a CDN base URL and root path through when supplied", () => {
    const c = buildUploadConfig(
      envFrom({ ...FULL, S3_PUBLIC_URL: "https://cdn.example.com", S3_ROOT_PATH: "fixocargo" }),
    );
    expect((c.providerOptions as any).baseUrl).toBe("https://cdn.example.com");
    expect((c.providerOptions as any).rootPath).toBe("fixocargo");
  });
});
