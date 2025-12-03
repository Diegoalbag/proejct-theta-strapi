import type { Schema, Struct } from '@strapi/strapi';

export interface TestSectionInstance extends Struct.ComponentSchema {
  collectionName: 'components_test_section_instances';
  info: {
    displayName: 'SectionInstance';
  };
  attributes: {
    data: Schema.Attribute.JSON;
    order: Schema.Attribute.Integer;
    sectionKey: Schema.Attribute.String;
  };
}

declare module '@strapi/strapi' {
  export module Public {
    export interface ComponentSchemas {
      'test.section-instance': TestSectionInstance;
    }
  }
}
