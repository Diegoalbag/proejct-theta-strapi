import type { Schema, Struct } from '@strapi/strapi';

export interface SharedSeo extends Struct.ComponentSchema {
  collectionName: 'components_shared_seos';
  info: {
    description: 'Attached non-repeatably to both Page and Site so the Phase-15 fallback chain reads one vocabulary. The Site-level copy exists per D-02 but is not read as a page default until Phase 15.';
    displayName: 'SEO';
    icon: 'search';
  };
  attributes: {
    description: Schema.Attribute.Text;
    noindex: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    shareImage: Schema.Attribute.Media<'images'>;
    title: Schema.Attribute.String;
  };
}

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
      'shared.seo': SharedSeo;
      'test.block-instance': TestBlockInstance;
      'test.section-instance': TestSectionInstance;
    }
  }
}
