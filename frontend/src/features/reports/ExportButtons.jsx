import { FileSpreadsheet, FileText, FileType } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { downloadExpensesExport } from '@/api/exports.api';
import { getErrorMessage, getErrorStatus, isNetworkError } from '@/api/axiosClient';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { toast } from '@/hooks/useToast';
import { saveBlob } from '@/utils/download';

const FORMATS = [
  { value: 'csv', label: 'CSV', icon: FileText },
  { value: 'xlsx', label: 'Excel', icon: FileSpreadsheet },
  { value: 'pdf', label: 'PDF', icon: FileType },
];

/**
 * Three buttons that download the expenses of a date range as CSV, Excel or PDF.
 * from, to: "YYYY-MM-DD". periodLabel: the same period as text, for the hint.
 * The export holds the expenses of every account and currency (the API never converts).
 */
export function ExportButtons({ from, to, periodLabel }) {
  const { t } = useTranslation();
  const exportFile = useMutation({ mutationFn: downloadExpensesExport });
  const busyFormat = exportFile.isPending ? exportFile.variables?.format : null;

  const errorText = (error) => {
    if (isNetworkError(error)) return t('errors.network');
    const status = getErrorStatus(error);
    // 400: more than 5000 expenses. 429: the export limit was reached.
    if (status === 400) return t('reports.exportTooLarge');
    if (status === 429) return t('reports.exportRateLimit');
    return getErrorMessage(error, t('errors.generic'));
  };

  const run = (format) => {
    exportFile.mutate(
      { format, from, to },
      {
        onSuccess: ({ blob, filename }) => {
          saveBlob(blob, filename);
          toast.success(t('reports.exportDone', { name: filename }));
        },
        onError: (error) => toast.error(errorText(error)),
      },
    );
  };

  return (
    <Card>
      <CardHeader
        title={t('reports.exportTitle')}
        description={t('reports.exportHint', { period: periodLabel })}
      />
      <div className="flex flex-wrap gap-2">
        {FORMATS.map(({ value, label, icon: Icon }) => (
          <Button
            key={value}
            variant="outline"
            aria-label={t('reports.exportAs', { format: label })}
            loading={busyFormat === value}
            disabled={exportFile.isPending}
            iconStart={<Icon className="h-4 w-4" />}
            onClick={() => run(value)}
          >
            {label}
          </Button>
        ))}
      </div>
    </Card>
  );
}
