import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { MoreVertical } from 'lucide-react';
import { cn } from '@/utils/cn';
import { buttonStyles } from '@/components/ui/Button';

const ENABLED_ITEMS = '[role="menuitem"]:not([disabled])';

/**
 * An action menu (the "three dots" of a table row, for example).
 *
 * <Dropdown
 *   label={t('common.actions')}
 *   items={[
 *     { label: t('common.edit'), icon: <Pencil className="h-4 w-4" />, onSelect: () => edit(row) },
 *     { separator: true },
 *     { label: t('common.delete'), icon: <Trash2 className="h-4 w-4" />, variant: 'danger', onSelect: () => ask(row) },
 *   ]}
 * />
 *
 * children = the trigger content (default: a three dots icon). label is the accessible name
 * of the trigger button and is required while the trigger shows only an icon.
 * Keyboard: Enter/Space/Arrow keys open, Arrow keys/Home/End move, Escape closes and
 * returns the focus to the trigger, Tab closes. align: end (default) | start.
 * Item: { key?, label, icon?, onSelect, variant?: 'danger', disabled? } or { separator: true }.
 */
export function Dropdown({
  items,
  label,
  children,
  align = 'end',
  variant = 'ghost',
  size = 'icon',
  disabled = false,
  className,
  triggerClassName,
  menuClassName,
}) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const startAt = useRef('first');
  const menuId = useId();

  const close = useCallback((refocus = false) => {
    setOpen(false);
    if (refocus) triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return undefined;

    const nodes = menuRef.current?.querySelectorAll(ENABLED_ITEMS);
    if (nodes?.length) {
      (startAt.current === 'last' ? nodes[nodes.length - 1] : nodes[0]).focus();
    }

    const onPointerDown = (event) => {
      if (!wrapperRef.current?.contains(event.target)) setOpen(false);
    };

    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  const onTriggerKeyDown = (event) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      startAt.current = event.key === 'ArrowUp' ? 'last' : 'first';
      setOpen(true);
    }
  };

  const onMenuKeyDown = (event) => {
    const nodes = [...(menuRef.current?.querySelectorAll(ENABLED_ITEMS) ?? [])];
    if (nodes.length === 0) return;
    const current = nodes.indexOf(document.activeElement);

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        nodes[(current + 1) % nodes.length].focus();
        break;
      case 'ArrowUp':
        event.preventDefault();
        nodes[current <= 0 ? nodes.length - 1 : current - 1].focus();
        break;
      case 'Home':
        event.preventDefault();
        nodes[0].focus();
        break;
      case 'End':
        event.preventDefault();
        nodes[nodes.length - 1].focus();
        break;
      case 'Escape':
        // stopPropagation: a dropdown inside a Modal must not close the modal too.
        event.preventDefault();
        event.stopPropagation();
        close(true);
        break;
      case 'Tab':
        close();
        break;
      default:
        break;
    }
  };

  return (
    <div ref={wrapperRef} className={cn('relative inline-block', className)}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        className={buttonStyles({ variant, size, className: triggerClassName })}
        onClick={() => {
          startAt.current = 'first';
          setOpen((value) => !value);
        }}
        onKeyDown={onTriggerKeyDown}
      >
        {children ?? <MoreVertical className="h-5 w-5" aria-hidden="true" />}
      </button>

      {open ? (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label={label}
          onKeyDown={onMenuKeyDown}
          className={cn(
            'absolute top-full z-30 mt-1 min-w-[12rem] animate-scale-in rounded-xl border border-line bg-surface p-1 shadow-lg',
            align === 'start' ? 'start-0' : 'end-0',
            menuClassName,
          )}
        >
          {items.map((item, index) =>
            item.separator ? (
              <div key={`separator-${index}`} role="separator" className="my-1 h-px bg-line" />
            ) : (
              <button
                key={item.key ?? item.label}
                type="button"
                role="menuitem"
                tabIndex={-1}
                disabled={item.disabled}
                onClick={() => {
                  close(true);
                  item.onSelect?.();
                }}
                className={cn(
                  'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-start text-sm transition-colors',
                  'hover:bg-surface-muted focus-visible:bg-surface-muted focus-visible:ring-inset focus-visible:ring-offset-0',
                  'disabled:pointer-events-none disabled:opacity-50',
                  item.variant === 'danger' ? 'text-danger' : 'text-content',
                )}
              >
                {item.icon ? (
                  <span className="shrink-0" aria-hidden="true">
                    {item.icon}
                  </span>
                ) : null}
                <span className="truncate">{item.label}</span>
              </button>
            ),
          )}
        </div>
      ) : null}
    </div>
  );
}
