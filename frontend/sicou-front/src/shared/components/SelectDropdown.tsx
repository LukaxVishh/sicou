import {
  Check,
  ChevronDown,
} from 'lucide-react';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';

export type SelectDropdownOption = {
  value: string;
  label: string;
  description?: string;
};

type SelectDropdownProps = {
  value: string;
  options: SelectDropdownOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  ariaLabel?: string;
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
  ariaLabel = 'Selecionar opção',
}: SelectDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null);

  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

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

  function handleSelect(optionValue: string) {
    onChange(optionValue);
    handleClose();
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

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        handleClose();
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
        >
          {options.map((option) => {
            const isSelected = option.value === value;

            return (
              <button
                key={option.value}
                type="button"
                onClick={() => handleSelect(option.value)}
                className="flex w-full items-start justify-between gap-3 px-3 py-2.5 text-left text-sm transition hover:bg-slate-100"
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
        onClick={handleToggle}
        disabled={disabled}
        className="mt-2 flex w-full items-center justify-between gap-3 rounded-lg border border-slate-300 bg-white px-3 py-2 text-left text-sm text-slate-900 outline-none transition hover:bg-slate-50 focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 disabled:cursor-not-allowed disabled:opacity-70"
        aria-label={ariaLabel}
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