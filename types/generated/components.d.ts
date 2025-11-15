import type { Schema, Struct } from '@strapi/strapi';

export interface ReferencesSectionReference extends Struct.ComponentSchema {
  collectionName: 'components_references_section_references';
  info: {
    displayName: 'SectionReference';
    icon: 'oneToOne';
  };
  attributes: {
    section: Schema.Attribute.Relation<'oneToOne', 'api::section.section'>;
  };
}

declare module '@strapi/strapi' {
  export module Public {
    export interface ComponentSchemas {
      'references.section-reference': ReferencesSectionReference;
    }
  }
}
