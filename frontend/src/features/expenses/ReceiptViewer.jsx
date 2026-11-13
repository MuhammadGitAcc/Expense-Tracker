import { useEffect, useState } from 'react';
import { Download, ExternalLink } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { LoadingScreen } from '@/components/common/LoadingScreen';
import { Button } from '@/components/ui/Button';
import { useReceipt } from '@/features/expenses/useExpenses';

const extensionOf = (blob) => (blob?.type.split('/')[1] ?? 'file').replace('jpeg', 'jpg');

/**
 * Shows the private receipt of an expense (an image or a PDF). The file is loaded through the
 * API client (Authorization header) and shown from an object URL that is freed on close.
 */
export function ReceiptViewer({ expenseId }) {
  const { t } = useTranslation();
  const { data: blob, isLoading, isError, refetch } = useReceipt(expenseId);
  const [url, setUrl] = useState(null);

  useEffect(() => {
    if (!blob) return undefined;
    const objectUrl = URL.createObjectURL(blob);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [blob]);

  if (isLoading) return <LoadingScreen fullScreen={false} className="min-h-[30vh]" />;

  if (isError) {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <p className="text-sm text-content-muted">{t('expenses.receiptLoadFailed')}</p>
        <Button variant="outline" onClick={() => refetch()}>
          {t('common.tryAgain')}
        </Button>
      </div>
    );
  }

  const isPdf = blob?.type === 'application/pdf';

  return (
    <div className="space-y-4">
      {url ? (
        isPdf ? (
          <iframe
            title={t('expenses.receiptTitle')}
            src={url}
            className="h-[60vh] w-full rounded-lg border border-line"
          />
        ) : (
          <img
            src={url}
            alt={t('expenses.receiptTitle')}
            className="mx-auto max-h-[60vh] max-w-full rounded-lg object-contain"
          />
        )
      ) : null}

      {url ? (
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            as="a"
            variant="outline"
            href={url}
            target="_blank"
            rel="noreferrer"
            iconStart={<ExternalLink className="h-4 w-4" />}
          >
            {t('expenses.receiptOpen')}
          </Button>
          <Button
            as="a"
            href={url}
            download={`receipt.${extensionOf(blob)}`}
            iconStart={<Download className="h-4 w-4" />}
          >
            {t('expenses.receiptDownload')}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
