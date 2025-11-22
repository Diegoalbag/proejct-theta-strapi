import type { Core } from '@strapi/strapi';

export default {
  /**
   * An asynchronous register function that runs before
   * your application is initialized.
   *
   * This gives you an opportunity to extend code.
   */
  register({ strapi }: { strapi: Core.Strapi }) {
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
  },

  /**
   * An asynchronous bootstrap function that runs before
   * your application gets started.
   *
   * This gives you an opportunity to set up your data model,
   * run jobs, or perform some special logic.
   */
  bootstrap(/* { strapi }: { strapi: Core.Strapi } */) {},
};
