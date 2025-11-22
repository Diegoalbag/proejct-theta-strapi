import type { Core } from '@strapi/strapi';

const register = ({ strapi }: { strapi: Core.Strapi }) => {
  // register phase
  strapi.customFields.register({
    name: "FieldValue",
    plugin: "adaptive-value-field",
    type: "json",
  });
};

export default register;
