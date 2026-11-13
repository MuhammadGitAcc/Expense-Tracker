import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { cn } from '@/utils/cn';

/** A card with a title for one chart: <ChartCard title description>{chart}</ChartCard> */
export function ChartCard({ title, description, className, children }) {
  return (
    <Card className={cn('h-full', className)}>
      <CardHeader title={title} description={description} />
      {children}
    </Card>
  );
}

/** The grey block shown while a chart loads (also the Suspense fallback of the lazy chart files). */
export function ChartSkeleton({ className }) {
  return (
    <Card aria-hidden="true" className={cn('h-full space-y-4', className)}>
      <Skeleton className="h-5 w-44" />
      <Skeleton className="h-60 w-full" />
    </Card>
  );
}

/** A failed load inside a chart card, with a Try again button. */
export function ChartError({ title, onRetry }) {
  const { t } = useTranslation();
  return (
    <ChartCard title={title}>
      <EmptyState
        className="py-8"
        title={t('errors.somethingWrong')}
        description={t('errors.loadFailed')}
        action={<Button onClick={onRetry}>{t('common.tryAgain')}</Button>}
      />
    </ChartCard>
  );
}
