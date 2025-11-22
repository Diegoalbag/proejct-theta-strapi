import * as React from "react";

import { useIntl } from "react-intl";

const Input = React.forwardRef((props: any, ref: React.Ref<HTMLInputElement>) => {
const { attribute, disabled, intlLabel, name, onChange, required, value } =
  props; // these are just some of the props passed by the content-manager

const { formatMessage } = useIntl();

const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  onChange({
    target: { name, type: attribute.type, value: e.currentTarget.value },
  });
};

// Safely format the label, with fallback
const labelText = intlLabel?.id 
  ? formatMessage(intlLabel)
  : intlLabel?.defaultMessage || name || 'Value';

return (
  <label>
    {labelText}
    <input
      ref={ref as React.Ref<HTMLInputElement>}
      name={name}
      disabled={disabled}
      value={value || ''}
      required={required}
      onChange={handleChange}
    />
  </label>
);
});

export default Input;