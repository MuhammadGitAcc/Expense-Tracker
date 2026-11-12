import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/utils/cn';
import { Button } from '@/components/ui/Button';

const SIZES = { sm: 'sm:max-w-sm', md: 'sm:max-w-lg', lg: 'sm:max-w-2xl' };

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Open modals, topmost last. Only the topmost one reacts to Escape and Tab,
// so a ConfirmDialog on top of a Modal closes alone.
const stack = [];

// Page scroll is locked while at least one modal is open.
let lockCount = 0;
let previousOverflow = '';

function lockScroll() {
  if (lockCount === 0) {
    previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }
  lockCount += 1;
}

function unlockScroll() {
  lockCount = Math.max(0, lockCount - 1);
  if (lockCount === 0) document.body.style.overflow = previousOverflow;
}

/**
 * <Modal open={open} onClose={() => setOpen(false)} title="Add expense" footer={<Button>Save</Button>}>
 *   ...form...
 * </Modal>
 *
 * Phone: slides up from the bottom as a sheet. Larger screens: centered dialog.
 * Escape, the close button and a click on the dark background call onClose.
 * Focus moves inside, stays inside (Tab loops) and returns to the opener on close.
 * Put data-autofocus on the element that should get the focus first.
 * Pass ariaLabel when there is no title.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  ariaLabel,
  size = 'md',
  closeOnOverlay = true,
  hideCloseButton = false,
  footer,
  className,
  children,
}) {
  const { t } = useTranslation();
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef(null);
  const onCloseRef = useRef(onClose);

  // Keep the latest onClose without restarting the effect below on every render.
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return undefined;

    const token = Symbol('modal');
    const previouslyFocused = document.activeElement;
    const panel = panelRef.current;

    stack.push(token);
    lockScroll();

    const candidates = panel ? [...panel.querySelectorAll(FOCUSABLE)] : [];
    const first =
      panel?.querySelector('[data-autofocus]') ??
      candidates.find((element) => !element.hasAttribute('data-modal-close'));
    (first ?? panel)?.focus();

    const onKeyDown = (event) => {
      if (stack[stack.length - 1] !== token) return;

      if (event.key === 'Escape') {
        event.stopPropagation();
        onCloseRef.current?.();
        return;
      }

      if (event.key !== 'Tab' || !panel) return;

      const items = [...panel.querySelectorAll(FOCUSABLE)];
      if (items.length === 0) {
        event.preventDefault();
        panel.focus();
        return;
      }

      const firstItem = items[0];
      const lastItem = items[items.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && (active === firstItem || active === panel)) {
        event.preventDefault();
        lastItem.focus();
      } else if (!event.shiftKey && active === lastItem) {
        event.preventDefault();
        firstItem.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      const index = stack.indexOf(token);
      if (index >= 0) stack.splice(index, 1);
      unlockScroll();
      if (previouslyFocused instanceof HTMLElement && document.contains(previouslyFocused)) {
        previouslyFocused.focus();
      }
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      {/* The dark background. mousedown (not click) so a text selection that ends outside does not close the modal. */}
      <div
        className="absolute inset-0 animate-fade-in bg-black/50"
        aria-hidden="true"
        onMouseDown={closeOnOverlay ? () => onCloseRef.current?.() : undefined}
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={description ? descriptionId : undefined}
        aria-label={title ? undefined : ariaLabel}
        tabIndex={-1}
        className={cn(
          'relative flex max-h-[90dvh] w-full flex-col rounded-t-2xl border border-line bg-surface pb-safe shadow-xl',
          'animate-slide-up sm:animate-scale-in sm:rounded-2xl sm:pb-0',
          SIZES[size] ?? SIZES.md,
          className,
        )}
      >
        {title || !hideCloseButton ? (
          <div className="flex items-start justify-between gap-3 px-5 pb-2 pt-5">
            <div className="min-w-0">
              {title ? (
                <h2 id={titleId} className="text-lg font-semibold text-content">
                  {title}
                </h2>
              ) : null}
              {description ? (
                <p id={descriptionId} className="mt-1 text-sm text-content-muted">
                  {description}
                </p>
              ) : null}
            </div>
            {hideCloseButton ? null : (
              <Button
                variant="ghost"
                size="icon"
                className="-me-2 -mt-2 shrink-0"
                aria-label={t('common.close')}
                data-modal-close
                onClick={() => onCloseRef.current?.()}
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </Button>
            )}
          </div>
        ) : null}

        <div className="flex-1 overflow-y-auto px-5 py-3">{children}</div>

        {footer ? (
          <div className="flex flex-col-reverse gap-2 border-t border-line px-5 py-4 sm:flex-row sm:justify-end">
            {footer}
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
