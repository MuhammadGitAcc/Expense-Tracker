import { AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/utils/cn';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';

/**
 * <ConfirmDialog
 *   open={Boolean(toDelete)}
 *   title={t('expenses.deleteTitle')}
 *   description={t('expenses.deleteText')}
 *   confirmLabel={t('common.delete')}
 *   loading={remove.isPending}
 *   onConfirm={() => remove.mutate(toDelete.id)}
 *   onClose={() => setToDelete(null)}
 * />
 *
 * It never closes itself: the parent closes it after the action worked.
 * While loading, Escape, the background and Cancel are blocked.
 * variant: danger (default, red button + warning icon) | primary.
 * Labels fall back to common.confirm and common.cancel.
 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel,
  cancelLabel,
  variant = 'danger',
  loading = false,
  children,
}) {
  const { t } = useTranslation();
  const isDanger = variant === 'danger';

  return (
    <Modal
      open={open}
      onClose={loading ? undefined : onClose}
      title={title}
      size="sm"
      hideCloseButton
      closeOnOverlay={!loading}
      footer={
        <>
          <Button variant="outline" data-autofocus disabled={loading} onClick={onClose}>
            {cancelLabel ?? t('common.cancel')}
          </Button>
          <Button variant={isDanger ? 'danger' : 'primary'} loading={loading} onClick={onConfirm}>
            {confirmLabel ?? t('common.confirm')}
          </Button>
        </>
      }
    >
      <div className="flex items-start gap-3">
        {isDanger ? (
          <span
            className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-danger-soft text-danger',
            )}
            aria-hidden="true"
          >
            <AlertTriangle className="h-5 w-5" />
          </span>
        ) : null}
        <div className="min-w-0 text-sm text-content-muted">
          {description ? <p>{description}</p> : null}
          {children}
        </div>
      </div>
    </Modal>
  );
}
