/**
 * article controller
 *
 * Extended with one custom action, `unpublish` — the first content-api
 * controller action in this repo beyond the auto-generated
 * `factories.createCoreController` form. See
 * `src/api/article/routes/01-article-unpublish.ts` for the full rationale
 * (RESEARCH Pitfall 1): Strapi 5's generated GraphQL and default REST
 * Content API expose only create/update/delete, `update` with a draft status
 * only ever writes the draft row and never removes a published one, and this
 * action calling the real `strapi.documents(uid).unpublish({ documentId })`
 * Document Service method is therefore the sole mechanism behind BLOG-03's
 * unpublish verb. RESEARCH Assumption A2: the existing full-access
 * `dashboard-token` API token is expected to authorize this new action with
 * no separate permission grant — if it 403s in Task 3's live check, add an
 * explicit grant in `src/index.ts` following the existing
 * `FORM_INGEST_PERMISSIONS` pattern.
 */
import { factories } from '@strapi/strapi'

export default factories.createCoreController('api::article.article', ({ strapi }) => ({
  async unpublish(ctx) {
    const { documentId } = ctx.params;

    if (!documentId) {
      return ctx.badRequest('documentId is required');
    }

    const result = await strapi.documents('api::article.article').unpublish({ documentId });

    if (!result) {
      return ctx.notFound();
    }

    ctx.body = { data: result };
  },
}));
