import { useEffect, useId, useRef, useState } from 'react';
import { FileText, Trash2, UploadCloud } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/utils/cn';
import { ACCEPTED_RECEIPT_TYPES, MAX_UPLOAD_MB } from '@/utils/constants';
import { Button } from '@/components/ui/Button';
import { FormField, describedBy } from '@/components/ui/FormField';

function formatBytes(bytes) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** ['image/jpeg', 'application/pdf'] to "JPG, PDF". */
const typeNames = (accept) =>
  accept.map((type) => type.split('/')[1].toUpperCase().replace('JPEG', 'JPG')).join(', ');

/**
 * One file, chosen by click or drag and drop. The file is checked here (type and size) before
 * onChange is called; the server checks the real bytes again.
 *
 * <FileUpload label={t('expenses.receipt')} value={file} onChange={setFile} />
 * With react-hook-form: <Controller name="receipt" control={control} render={({ field }) =>
 *   <FileUpload value={field.value} onChange={field.onChange} /> } />
 *
 * value: a File or null. accept: list of mime types (default: images + PDF, like receipts).
 * Use ACCEPTED_IMAGE_TYPES for avatars. Images get a small preview.
 */
export function FileUpload({
  id,
  label,
  hint,
  error,
  required,
  value = null,
  onChange,
  accept = ACCEPTED_RECEIPT_TYPES,
  maxSizeMb = MAX_UPLOAD_MB,
  disabled = false,
  className,
}) {
  const { t } = useTranslation();
  const autoId = useId();
  const fieldId = id ?? autoId;
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [localError, setLocalError] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);

  useEffect(() => {
    if (!value || !value.type.startsWith('image/')) {
      setPreviewUrl(null);
      return undefined;
    }
    const url = URL.createObjectURL(value);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [value]);

  const choose = (file) => {
    if (!file) return;
    if (!accept.includes(file.type)) {
      setLocalError(t('upload.invalidType', { types: typeNames(accept) }));
      return;
    }
    if (file.size > maxSizeMb * 1024 * 1024) {
      setLocalError(t('upload.tooLarge', { max: maxSizeMb }));
      return;
    }
    setLocalError(null);
    onChange?.(file);
  };

  const remove = () => {
    setLocalError(null);
    onChange?.(null);
  };

  const message = error ?? localError;
  const defaultHint = t('upload.hint', { types: typeNames(accept), max: maxSizeMb });

  return (
    <FormField
      id={fieldId}
      label={label}
      hint={hint ?? defaultHint}
      error={message}
      required={required}
      className={className}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept.join(',')}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        disabled={disabled}
        onChange={(event) => {
          choose(event.target.files?.[0]);
          event.target.value = ''; // lets the same file be chosen again
        }}
      />

      {value ? (
        <div className="flex items-center gap-3 rounded-lg border border-line bg-surface p-3">
          {previewUrl ? (
            <img src={previewUrl} alt="" className="h-12 w-12 shrink-0 rounded-md object-cover" />
          ) : (
            <span
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-surface-muted text-content-muted"
              aria-hidden="true"
            >
              <FileText className="h-6 w-6" />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-content">{value.name}</p>
            <p className="text-xs text-content-muted">
              <span className="amount">{formatBytes(value.size)}</span>
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            aria-label={t('upload.remove')}
            disabled={disabled}
            onClick={remove}
          >
            <Trash2 className="h-5 w-5" aria-hidden="true" />
          </Button>
        </div>
      ) : (
        <button
          id={fieldId}
          type="button"
          disabled={disabled}
          aria-describedby={describedBy(fieldId, { error: message, hint: hint ?? defaultHint })}
          onClick={() => inputRef.current?.click()}
          onDragOver={(event) => {
            event.preventDefault();
            if (!disabled) setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            if (!disabled) choose(event.dataTransfer.files?.[0]);
          }}
          className={cn(
            'flex w-full flex-col items-center gap-1 rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors',
            'disabled:cursor-not-allowed disabled:opacity-60',
            message
              ? 'border-danger'
              : dragging
                ? 'border-primary bg-primary-soft'
                : 'border-line hover:bg-surface-muted',
          )}
        >
          <UploadCloud className="h-6 w-6 text-content-muted" aria-hidden="true" />
          <span className="text-sm font-medium text-content">{t('upload.dropOrBrowse')}</span>
        </button>
      )}
    </FormField>
  );
}
