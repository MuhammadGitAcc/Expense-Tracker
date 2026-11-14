import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MoreVertical } from 'lucide-react';
import { cn } from '@/utils/cn';
import { buttonStyles } from '@/components/ui/Button';

const ENABLED_ITEMS = '[role="menuitem"]:not([disabled])';

const GAP = 4;
const MARGIN = 8;

/** Puts the open menu next to its button, inside the window: flips up when there is no room below. */
function placeMenu(trigger, menu, align) {
  if (!trigger || !menu) return;
  const button = trigger.getBoundingClientRect();
  const box = menu.getBoundingClientRect();
  const viewWidth = document.documentElement.clientWidth;
  const viewHeight = window.innerHeight;

  const roomBelow = viewHeight - button.bottom - GAP - MARGIN;
  const roomAbove = button.top - GAP - MARGIN;
  const openUp = box.height > roomBelow && roomAbove > roomBelow;
  const top = openUp ? button.top - GAP - box.height : button.bottom + GAP;

  // "end" is the right edge in English and the left edge in Arabic (right-to-left).
  const rtl = document.documentElement.dir === 'rtl';
  const alignRight = (align === 'end') !== rtl;
  const left = alignRight ? button.right - box.width : button.left;

  menu.style.top = `${Math.max(MARGIN, Math.min(top, viewHeight - box.height - MARGIN))}px`;
  menu.style.left = `${Math.max(MARGIN, Math.min(left, viewWidth - box.width - MARGIN))}px`;
}

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
 * The menu is drawn over the page (not inside a table or a card), so it is never cut off.
 * It opens upward when there is no room below, and closes on scroll and on resize.
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

  useLayoutEffect(() => {
    if (!open) return undefined;

    placeMenu(triggerRef.current, menuRef.current, align);

    const nodes = menuRef.current?.querySelectorAll(ENABLED_ITEMS);
    if (nodes?.length) {
      const target = startAt.current === 'last' ? nodes[nodes.length - 1] : nodes[0];
      target.focus({ preventScroll: true });
    }
    return undefined;
  }, [open, align]);

  useEffect(() => {
    if (!open) return undefined;

    const onPointerDown = (event) => {
      const inside =
        wrapperRef.current?.contains(event.target) || menuRef.current?.contains(event.target);
      if (!inside) setOpen(false);
    };
    const onScroll = (event) => {
      if (!menuRef.current?.contains(event.target)) setOpen(false);
    };
    const onResize = () => setOpen(false);

    document.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
    };
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
        close(true);
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

      {open
        ? createPortal(
            <div
              ref={menuRef}
              id={menuId}
              role="menu"
              aria-label={label}
              onKeyDown={onMenuKeyDown}
              className={cn(
                'fixed z-[55] max-h-[calc(100dvh-1rem)] min-w-[12rem] animate-scale-in overflow-y-auto rounded-xl border border-line bg-surface p-1 shadow-lg',
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
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
