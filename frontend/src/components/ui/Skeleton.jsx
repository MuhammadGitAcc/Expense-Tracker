import { cn } from '@/utils/cn';

/** A grey pulsing block shown while data loads. Give it the size of the real content. */
export function Skeleton({ className, ...props }) {
  return (
    <div
      aria-hidden="true"
      className={cn('animate-pulse rounded-md bg-line/70', className)}
      {...props}
    />
  );
}

/** Several lines of text; the last one is shorter. */
export function SkeletonText({ lines = 3, className }) {
  return (
    <div className={cn('space-y-2', className)} aria-hidden="true">
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton
          key={index}
          className={cn('h-4', index === lines - 1 && lines > 1 ? 'w-2/3' : 'w-full')}
        />
      ))}
    </div>
  );
}
