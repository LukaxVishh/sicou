import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router';

export type ActionsDropdownItem = {
  label: string;
  icon?: ReactNode;
  to?: string;
  onClick?: () => void;
  variant?: 'default' | 'danger';
  disabled?: boolean;
};

type ActionsDropdownProps = {
  items: ActionsDropdownItem[];
  label?: string;
};

type MenuPosition = {
  right: number;
  top?: number;
  bottom?: number;
  placement: 'top' | 'bottom';
};

export function ActionsDropdown({
  items,
  label = 'Abrir ações',
}: ActionsDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null);

  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const updateMenuPosition = useCallback(() => {
    const button = buttonRef.current;

    if (!button) {
      return;
    }

    const rect = button.getBoundingClientRect();

    const estimatedMenuHeight = Math.min((items.length * 40) + 8, 240);
    const spacing = 8;

    const availableBelow = window.innerHeight - rect.bottom;
    const availableAbove = rect.top;

    const shouldOpenUp =
      availableBelow < estimatedMenuHeight + spacing
      && availableAbove > availableBelow;

    if (shouldOpenUp) {
      setMenuPosition({
        right: window.innerWidth - rect.right,
        bottom: window.innerHeight - rect.top + spacing,
        placement: 'top',
      });

      return;
    }

    setMenuPosition({
      right: window.innerWidth - rect.right,
      top: rect.bottom + spacing,
      placement: 'bottom',
    });
  }, [items.length]);

  const handleClose = useCallback(() => {
    setIsOpen(false);
  }, []);

  function handleToggle() {
    if (!isOpen) {
      updateMenuPosition();
    }

    setIsOpen((current) => !current);
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

  function getItemClassName(item: ActionsDropdownItem) {
    const baseClassName = 'flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60';

    if (item.variant === 'danger') {
      return `${baseClassName} text-rose-600 hover:bg-rose-50`;
    }

    return `${baseClassName} text-slate-700 hover:bg-slate-100`;
  }

  const menu = isOpen && menuPosition
    ? createPortal(
      <>
        <style>
          {`
            @keyframes actionsDropdownDown {
              from {
                opacity: 0;
                transform: translateY(-6px) scale(0.98);
              }

              to {
                opacity: 1;
                transform: translateY(0) scale(1);
              }
            }

            @keyframes actionsDropdownUp {
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
          className="fixed z-[9999] w-48 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-xl ring-1 ring-slate-900/5"
          style={{
            top: menuPosition.top,
            right: menuPosition.right,
            bottom: menuPosition.bottom,
            transformOrigin:
              menuPosition.placement === 'top'
                ? 'bottom right'
                : 'top right',
            animation:
              menuPosition.placement === 'top'
                ? 'actionsDropdownUp 140ms ease-out'
                : 'actionsDropdownDown 140ms ease-out',
          }}
          role="menu"
        >
          {items.map((item) => {
            if (item.to) {
              return (
                <Link
                  key={item.label}
                  to={item.to}
                  onClick={handleClose}
                  className={getItemClassName(item)}
                  role="menuitem"
                >
                  {item.icon}
                  {item.label}
                </Link>
              );
            }

            return (
              <button
                key={item.label}
                type="button"
                onClick={() => {
                  handleClose();
                  item.onClick?.();
                }}
                disabled={item.disabled}
                className={getItemClassName(item)}
                role="menuitem"
              >
                {item.icon}
                {item.label}
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
        className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={isOpen}
      >
        <svg
          className="h-5 w-5"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M7 12a1.75 1.75 0 1 1-3.5 0A1.75 1.75 0 0 1 7 12ZM13.75 12a1.75 1.75 0 1 1-3.5 0 1.75 1.75 0 0 1 3.5 0ZM20.5 12a1.75 1.75 0 1 1-3.5 0 1.75 1.75 0 0 1 3.5 0Z"
            fill="currentColor"
          />
        </svg>
      </button>

      {menu}
    </>
  );
}