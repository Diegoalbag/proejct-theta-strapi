/**
 * Upload-provider selection: S3-compatible object storage when configured,
 * Strapi's default local-disk provider otherwise.
 *
 * WHY (2026-08-10). Every tenant Strapi runs as a Railway container from
 * `ghcr.io/diegoalbag/proejct-theta-strapi:latest` with NO persistent volume and
 * NO upload provider — so uploads landed in the container's `/app/public/uploads`
 * and were destroyed on the next deploy. Because a push to this repo's `main`
 * rebuilds that image and auto-redeploys EVERY per-tenant Strapi, a single deploy
 * wiped media across the whole fleet. Observed on the live tenant: all 12 images on
 * the homepage returning 404 while Strapi itself was healthy.
 *
 * Only media committed to git survived, because `COPY --from=builder /app/public`
 * bakes it into the image — which is why the breakage looked partial (6 of 12) at
 * first and total later. That is not a storage strategy; it is an accident.
 *
 * WHY CONDITIONAL rather than always-on. Three environments must keep working with
 * no credentials at all: local development, CI, and any tenant not yet provisioned
 * with a bucket. Hard-requiring S3 would take every one of them down at boot — a far
 * worse failure than the one being fixed. So the provider engages only when a bucket
 * is actually configured, and its absence is a supported state rather than an error.
 *
 * ROLLOUT CONSEQUENCE, stated plainly: a tenant switched to S3 does NOT get its old
 * media back. Files already lost are lost, and files still baked into the image stay
 * reachable only while that image is deployed. Existing media must be re-uploaded
 * after switching. This function prevents recurrence; it does not repair history.
 *
 * S3-COMPATIBLE, not AWS-specific. `S3_ENDPOINT` + `S3_FORCE_PATH_STYLE` cover
 * Railway buckets, Cloudflare R2 and MinIO; omit the endpoint for real AWS S3.
 */

/** The env accessor Strapi hands config factories. */
type EnvFn = (key: string, defaultValue?: string) => string;

/** Shape merged into the upload plugin's `config`. Empty = keep local disk. */
export interface UploadProviderConfig {
  provider?: string;
  providerOptions?: Record<string, unknown>;
  actionOptions?: Record<string, unknown>;
}

const trim = (v: string | undefined): string => (typeof v === "string" ? v.trim() : "");

/**
 * The bucket name is the single switch. Credentials and region are read only
 * once a bucket is named, so a half-populated environment cannot silently
 * produce a broken provider — it stays on local disk instead.
 */
export function buildUploadConfig(env: EnvFn): UploadProviderConfig {
  const bucket = trim(env("S3_BUCKET", ""));
  if (!bucket) return {};

  const accessKeyId = trim(env("S3_ACCESS_KEY_ID", ""));
  const secretAccessKey = trim(env("S3_SECRET_ACCESS_KEY", ""));
  if (!accessKeyId || !secretAccessKey) {
    // Named a bucket but gave no credentials: almost certainly a misconfigured
    // tenant rather than a deliberate anonymous bucket. Staying on local disk
    // keeps the CMS up; the operator sees this line and fixes the variables.
    // eslint-disable-next-line no-console
    console.warn(
      "[upload-provider] S3_BUCKET is set but S3_ACCESS_KEY_ID/S3_SECRET_ACCESS_KEY are not — " +
        "falling back to local disk. Uploads will NOT survive redeploys until this is fixed.",
    );
    return {};
  }

  const endpoint = trim(env("S3_ENDPOINT", ""));
  const region = trim(env("S3_REGION", "")) || "auto";
  const baseUrl = trim(env("S3_PUBLIC_URL", ""));
  const rootPath = trim(env("S3_ROOT_PATH", ""));
  // Path-style addressing is required by most S3-compatible providers and
  // harmless-but-deprecated on real AWS, so default it on only when a custom
  // endpoint is present.
  const forcePathStyle = trim(env("S3_FORCE_PATH_STYLE", "")) === "false" ? false : Boolean(endpoint);

  return {
    provider: "aws-s3",
    providerOptions: {
      // Serves media from a CDN/public bucket URL instead of the Strapi origin
      // when provided. Without it the provider returns the bucket's own URL.
      ...(baseUrl ? { baseUrl } : {}),
      ...(rootPath ? { rootPath } : {}),
      s3Options: {
        credentials: { accessKeyId, secretAccessKey },
        region,
        ...(endpoint ? { endpoint } : {}),
        forcePathStyle,
        params: { Bucket: bucket },
      },
    },
    // Objects must be publicly readable: the theme-site and the customizer both
    // load these URLs directly from the browser, cross-origin, with no signing.
    actionOptions: {
      upload: { ACL: "public-read" },
      uploadStream: { ACL: "public-read" },
      delete: {},
    },
  };
}
