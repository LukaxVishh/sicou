import {
  Children,
  isValidElement,
  useEffect,
  useState,
  type ChangeEvent,
  type ChangeEventHandler,
  type ReactNode,
  type SelectHTMLAttributes,
} from 'react';
import { SelectDropdown, type SelectDropdownOption } from './SelectDropdown';

type NativeSelectDropdownProps = Omit<
  SelectHTMLAttributes<HTMLSelectElement>,
  'children' | 'onChange' | 'value' | 'defaultValue' | 'multiple' | 'size'
> & {
  children: ReactNode;
  value?: string | number;
  defaultValue?: string | number;
  onChange?: ChangeEventHandler<HTMLSelectElement>;
};

function readOptions(children: ReactNode): SelectDropdownOption[] {
  return Children.toArray(children).flatMap((child) => {
    if (!isValidElement<{ value?: string | number; disabled?: boolean; children?: ReactNode }>(child)) {
      return [];
    }

    if (child.type === 'optgroup') {
      return readOptions(child.props.children);
    }

    if (child.type !== 'option') {
      return [];
    }

    const value = String(child.props.value ?? child.props.children ?? '');
    const label = Children.toArray(child.props.children).join('');

    return [{
      value,
      label: label || value,
      disabled: child.props.disabled,
    }];
  });
}

/** Mantém a API JSX de <select> e apresenta o menu compartilhado do Sicou. */
export function NativeSelectDropdown({
  children,
  value,
  defaultValue,
  onChange,
  name,
  disabled,
  required,
  className,
  id,
  'aria-label': ariaLabel,
  'aria-describedby': ariaDescribedby,
  'aria-labelledby': ariaLabelledby,
}: NativeSelectDropdownProps) {
  const options = readOptions(children);
  const [internalValue, setInternalValue] = useState(() =>
    String(defaultValue ?? options[0]?.value ?? ''),
  );
  const selectedValue = String(value ?? internalValue);

  useEffect(() => {
    if (value === undefined && !options.some((option) => option.value === internalValue)) {
      setInternalValue(options[0]?.value ?? '');
    }
  }, [internalValue, options, value]);

  function handleChange(nextValue: string) {
    if (value === undefined) {
      setInternalValue(nextValue);
    }

    if (onChange) {
      const target = { value: nextValue, name } as unknown as HTMLSelectElement;
      onChange({ target, currentTarget: target } as unknown as ChangeEvent<HTMLSelectElement>);
    }
  }

  const classTokens = className?.split(/\s+/) ?? [];
  const getUtilityName = (token: string) => token.split(':').at(-1) ?? token;
  const layoutClasses = classTokens.filter((token) =>
    /^(w-|min-w-|max-w-|mt-|self-|col-span-|grow(?:$|-)|shrink(?:$|-))/.test(getUtilityName(token)),
  ).join(' ');
  const hasTopMargin = classTokens.some((token) => /^mt-/.test(getUtilityName(token)));

  return (
    <>
      <SelectDropdown
        value={selectedValue}
        options={options}
        onChange={handleChange}
        disabled={disabled}
        ariaLabel={ariaLabel}
        className={`${layoutClasses} ${hasTopMargin ? '' : 'mt-0'}`.trim()}
        id={id}
        ariaDescribedby={ariaDescribedby}
        ariaLabelledby={ariaLabelledby}
        required={required}
      />
      {(name || required) && (
        <select
          aria-hidden="true"
          tabIndex={-1}
          className="pointer-events-none absolute h-px w-px opacity-0"
          name={name}
          value={selectedValue}
          required={required}
          disabled={disabled}
          onChange={() => undefined}
        >
          {children}
        </select>
      )}
    </>
  );
}
