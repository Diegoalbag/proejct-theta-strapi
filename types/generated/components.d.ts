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

export interface SettingsSettingField extends Struct.ComponentSchema {
  collectionName: 'components_settings_setting_fields';
  info: {
    displayName: 'SettingField';
  };
  attributes: {
    key: Schema.Attribute.String & Schema.Attribute.Required;
    label: Schema.Attribute.String & Schema.Attribute.Required;
    type: Schema.Attribute.Enumeration<
      [
        'text',
        'textarea',
        'number',
        'boolean',
        'select',
        'color',
        'image',
        'url',
        'json',
      ]
    > &
      Schema.Attribute.Required;
    Value: Schema.Attribute.JSON &
      Schema.Attribute.CustomField<'plugin::adaptive-value-field.FieldValue'>;
  };
}

declare module '@strapi/strapi' {
  export module Public {
    export interface ComponentSchemas {
      'references.section-reference': ReferencesSectionReference;
      'settings.setting-field': SettingsSettingField;
    }
  }
}
