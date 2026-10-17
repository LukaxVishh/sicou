import {
  Check,
  ChevronDown,
} from 'lucide-react';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { twMerge } from 'tailwind-merge';

export type SelectDropdownOption = {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
};

type SelectDropdownProps = {
  value: string;
  options: SelectDropdownOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  ariaLabel?: string;
  className?: string;
  id?: string;
  ariaDescribedby?: string;
  ariaLabelledby?: string;
  required?: boolean;
};

type MenuPosition = {
  left: number;
  width: number;
  top?: number;
  bottom?: number;
  placement: 'top' | 'bottom';
};

export function SelectDropdown({
  value,
  options,
  onChange,
  placeholder = 'Selecione',
  disabled = false,
  ariaLabel,
  className,
  id,
  ariaDescribedby,
  ariaLabelledby,
  required,
}: SelectDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null);

  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const selectedOption = options.find((option) => option.value === value);

  const updateMenuPosition = useCallback(() => {
    const button = buttonRef.current;

    if (!button) {
      return;
    }

    const rect = button.getBoundingClientRect();

    const estimatedMenuHeight = Math.min((options.length * 48) + 8, 280);
    const spacing = 8;

    const availableBelow = window.innerHeight - rect.bottom;
    const availableAbove = rect.top;

    const shouldOpenUp =
      availableBelow < estimatedMenuHeight + spacing
      && availableAbove > availableBelow;

    if (shouldOpenUp) {
      setMenuPosition({
        left: rect.left,
        width: rect.width,
        bottom: window.innerHeight - rect.top + spacing,
        placement: 'top',
      });

      return;
    }

    setMenuPosition({
      left: rect.left,
      width: rect.width,
      top: rect.bottom + spacing,
      placement: 'bottom',
    });
  }, [options.length]);

  const handleClose = useCallback(() => {
    setIsOpen(false);
  }, []);

  function handleToggle() {
    if (disabled) {
      return;
    }

    if (!isOpen) {
      updateMenuPosition();
    }

    setIsOpen((current) => !current);
  }

  function moveFocus(direction: 'first' | 'last' | 'next' | 'previous') {
    const enabledIndices = options
      .map((option, index) => option.disabled ? -1 : index)
      .filter((index) => index >= 0);

    if (!enabledIndices.length) return;

    const currentIndex = enabledIndices.indexOf(
      optionRefs.current.indexOf(document.activeElement as HTMLButtonElement),
    );
    let targetIndex = enabledIndices[0];

    if (direction === 'last') targetIndex = enabledIndices.at(-1)!;
    if (direction === 'next' && currentIndex >= 0) {
      targetIndex = enabledIndices[(currentIndex + 1) % enabledIndices.length];
    }
    if (direction === 'previous' && currentIndex >= 0) {
      targetIndex = enabledIndices[(currentIndex - 1 + enabledIndices.length) % enabledIndices.length];
    }

    optionRefs.current[targetIndex]?.focus();
  }

  function handleTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const direction = event.key === 'ArrowDown'
      ? (isOpen ? 'next' : 'first')
      : event.key === 'ArrowUp'
        ? (isOpen ? 'previous' : 'last')
        : undefined;

    if (direction) {
      event.preventDefault();
      if (!isOpen) {
        updateMenuPosition();
        setIsOpen(true);
        requestAnimationFrame(() => moveFocus(direction));
      } else {
        moveFocus(direction);
      }
    }
  }

  function handleSelect(optionValue: string) {
    onChange(optionValue);
    handleClose();
    buttonRef.current?.focus();
  }

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;

      if (
        buttonRef.current?.contains(target)
        || menuRef.current?.contains(target)
      ) {
        return;
      }

      handleClose();
    }

    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === 'Escape') {
        handleClose();
        buttonRef.current?.focus();
      }
    }

    function handleWindowChange() {
      updateMenuPosition();
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', handleWindowChange);
    window.addEventListener('scroll', handleWindowChange, true);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleWindowChange);
      window.removeEventListener('scroll', handleWindowChange, true);
    };
  }, [isOpen, handleClose, updateMenuPosition]);

  const menu = isOpen && menuPosition
    ? createPortal(
      <>
        <style>
          {`
            @keyframes selectDropdownDown {
              from {
                opacity: 0;
                transform: translateY(-6px) scale(0.98);
              }

              to {
                opacity: 1;
                transform: translateY(0) scale(1);
              }
            }

            @keyframes selectDropdownUp {
              from {
                opacity: 0;
                transform: translateY(6px) scale(0.98);
              }

              to {
                opacity: 1;
                transform: translateY(0) scale(1);
              }
            }
          `}
        </style>

        <div
          ref={menuRef}
          className="fixed z-[9999] max-h-72 overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-xl ring-1 ring-slate-900/5"
          style={{
            left: menuPosition.left,
            width: menuPosition.width,
            top: menuPosition.top,
            bottom: menuPosition.bottom,
            transformOrigin:
              menuPosition.placement === 'top'
                ? 'bottom left'
                : 'top left',
            animation:
              menuPosition.placement === 'top'
                ? 'selectDropdownUp 140ms ease-out'
                : 'selectDropdownDown 140ms ease-out',
          }}
          role="listbox"
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
              event.preventDefault();
              moveFocus(event.key === 'ArrowDown' ? 'next' : 'previous');
            } else if (event.key === 'Home' || event.key === 'End') {
              event.preventDefault();
              moveFocus(event.key === 'Home' ? 'first' : 'last');
            }
          }}
        >
          {options.map((option, index) => {
            const isSelected = option.value === value;

            return (
              <button
                key={option.value}
                ref={(element) => { optionRefs.current[index] = element; }}
                type="button"
                disabled={option.disabled}
                onClick={() => handleSelect(option.value)}
                className="flex w-full items-start justify-between gap-3 px-3 py-2.5 text-left text-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                role="option"
                aria-selected={isSelected}
              >
                <span>
                  <span className="block font-medium text-slate-800">
                    {option.label}
                  </span>

                  {option.description && (
                    <span className="mt-0.5 block text-xs text-slate-500">
                      {option.description}
                    </span>
                  )}
                </span>

                {isSelected && (
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-slate-700" />
                )}
              </button>
            );
          })}
        </div>
      </>,
      document.body,
    )
    : null;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        id={id}
        onClick={handleToggle}
        onKeyDown={handleTriggerKeyDown}
        disabled={disabled}
        className={twMerge('mt-2 flex h-10 w-full items-center justify-between gap-3 rounded-lg border border-slate-300 bg-white px-3 py-2 text-left text-sm text-slate-900 outline-none transition hover:bg-slate-50 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15 disabled:cursor-not-allowed disabled:opacity-70', className)}
        aria-label={ariaLabel}
        aria-describedby={ariaDescribedby}
        aria-labelledby={ariaLabelledby}
        aria-required={required || undefined}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className={selectedOption ? 'text-slate-900' : 'text-slate-500'}>
          {selectedOption?.label ?? placeholder}
        </span>

        <ChevronDown
          className={`h-4 w-4 shrink-0 text-slate-500 transition ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {menu}
    </>
  );
}
