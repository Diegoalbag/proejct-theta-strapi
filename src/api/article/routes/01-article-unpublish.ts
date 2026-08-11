/**
 * article unpublish route
 *
 * FIRST custom route in this repo — every other `src/api/<name>/routes/<name>.ts`
 * file is an unmodified `factories.createCoreRouter(...)` call. This file is a
 * sibling module under `src/api/article/routes/`, not an edit to
 * `article.ts`: Strapi's API loader (`@strapi/core/dist/loaders/apis.js`
 * `loadDir`) reads every file in a `routes/` directory and keys the result by
 * filename, and `registerAPIRoutes` (`@strapi/core/dist/services/server/register-routes.js`)
 * then iterates and registers EACH file's router independently — so this file
 * and the untouched `article.ts` core router both register, side by side. The
 * numeric `01-` prefix keeps this file's presence explicit in a directory
 * listing next to the core router; Strapi's loader does not care about
 * ordering here since the two files register unrelated route paths.
 *
 * WHY THIS ROUTE EXISTS AT ALL (RESEARCH Pitfall 1)
 * Strapi 5's generated GraphQL and default REST Content API have no
 * unpublish action:
 * - `@strapi/plugin-graphql/dist/server/services/builders/mutations/collection-type.js`
 *   generates exactly three mutations per content type — create, update,
 *   delete. No publish/unpublish mutation is generated.
 * - `@strapi/core/dist/services/document-service/repository.js`'s `update()`
 *   always forces the write onto the DRAFT row via
 *   `draftAndPublish.setStatusToDraft(contentType)`; it only additionally
 *   calls `publish()` when the caller's status is `'published'`. There is no
 *   symmetric call to `unpublish()` for any caller-supplied status — so
 *   `updateArticle(documentId, data: {}, status: DRAFT)` silently does
 *   nothing to the live published version.
 * - `@strapi/core/dist/core-api/controller/collection-type.js` (the default
 *   token-authenticated Content API controller) exposes only
 *   `find/findOne/create/update/delete`, confirming the REST Content API has
 *   the identical gap.
 * The real `unpublish()` method exists on the Document Service
 * (`repository.js`, deletes every `publishedAt !== null` row for the
 * document) but is reachable only server-side via
 * `strapi.documents(uid).unpublish({ documentId })`, or the admin-only
 * content-manager REST action route (requires an admin JWT session — the
 * bootstrap super-admin's password is randomly generated and discarded, so
 * that path is not usable by the platform). This route is therefore the sole
 * mechanism behind BLOG-03's unpublish verb.
 *
 * AUTH (RESEARCH Assumption A2)
 * `config.auth` is deliberately omitted, not set to `false` — leaving auth at
 * its default keeps this route behind Strapi's normal content-API token
 * check, exactly like `setLiveTheme`/`setSiteUrl` already rely on for other
 * privileged server-side writes. A2 assumes the existing full-access
 * `dashboard-token` API token (see `src/index.ts`) is authorized to call a
 * newly added content-api action with no separate permission grant. If the
 * Task 3 deploy check finds this route 403ing for a valid full-access token,
 * A2 is wrong and the fix is an explicit permission grant in `src/index.ts`
 * following the existing `FORM_INGEST_PERMISSIONS` pattern (see that file for
 * the precedent of granting a token an action beyond its type's default).
 */
export default {
  routes: [
    {
      method: 'POST',
      path: '/articles/:documentId/unpublish',
      handler: 'article.unpublish',
      config: {
        policies: [],
        middlewares: [],
      },
    },
  ],
};
