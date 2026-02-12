"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    /**
     * An asynchronous register function that runs before
     * your application is initialized.
     *
     * This gives you an opportunity to extend code.
     */
    register({ strapi }) {
        // #region agent log
        fetch('http://127.0.0.1:7254/ingest/9bc2dd47-1b5d-4b07-87e2-58585f12464c', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'src/index.ts', message: 'register start', data: {}, timestamp: Date.now(), hypothesisId: 'H2', runId: 'post-fix' }) }).catch(() => { });
        // #endregion
        // Ensure the adaptive-setting plugin's custom field is registered early
        // This is a workaround to ensure the field is available before schemas are loaded
        // try {
        //   const plugin = strapi.plugin('adaptive-setting');
        //   if (plugin) {
        //     console.log('[Main App] Adaptive-setting plugin found');
        //   } else {
        //     console.log('[Main App] WARNING: Adaptive-setting plugin not found');
        //   }
        // } catch (error) {
        //   console.log('[Main App] Error accessing plugin:', error);
        // }
        // #region agent log
        fetch('http://127.0.0.1:7254/ingest/9bc2dd47-1b5d-4b07-87e2-58585f12464c', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'src/index.ts', message: 'register end', data: {}, timestamp: Date.now(), hypothesisId: 'H2', runId: 'post-fix' }) }).catch(() => { });
        // #endregion
    },
    /**
     * An asynchronous bootstrap function that runs before
     * your application gets started.
     *
     * This gives you an opportunity to set up your data model,
     * run jobs, or perform some special logic.
     */
    bootstrap( /* { strapi }: { strapi: Core.Strapi } */) { },
};
