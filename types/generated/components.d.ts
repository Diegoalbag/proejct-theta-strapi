import type { Schema, Struct } from '@strapi/strapi';

export interface TestBlockInstance extends Struct.ComponentSchema {
  collectionName: 'components_test_block_instances';
  info: {
    displayName: 'BlockInstance';
  };
  attributes: {
    blockType: Schema.Attribute.String;
    data: Schema.Attribute.JSON;
    order: Schema.Attribute.Integer;
  };
}

export interface TestSectionInstance extends Struct.ComponentSchema {
  collectionName: 'components_test_section_instances';
  info: {
    displayName: 'SectionInstance';
  };
  attributes: {
    blocks: Schema.Attribute.Component<'test.block-instance', true>;
    data: Schema.Attribute.JSON;
    order: Schema.Attribute.Integer;
    sectionKey: Schema.Attribute.String;
  };
}

declare module '@strapi/strapi' {
  export module Public {
    export interface ComponentSchemas {
      'test.block-instance': TestBlockInstance;
      'test.section-instance': TestSectionInstance;
    }
  }
}
