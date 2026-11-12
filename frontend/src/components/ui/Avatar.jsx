import { useState } from 'react';
import { cn } from '@/utils/cn';

const SIZES = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-14 w-14 text-lg',
  xl: 'h-24 w-24 text-2xl',
};

const TONES = [
  'bg-primary-soft text-primary-text',
  'bg-income-soft text-income',
  'bg-expense-soft text-expense',
  'bg-warning-soft text-warning',
];

function initialsOf(name = '') {
  const words = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  return (
    words
      .map((word) => Array.from(word)[0])
      .join('')
      .toUpperCase() || '?'
  );
}

function toneOf(name = '') {
  const hash = Array.from(name).reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) >>> 0, 7);
  return TONES[hash % TONES.length];
}

/** The profile picture when `src` loads, otherwise the initials of `name` on a colour. */
export function Avatar({ src, name = '', size = 'md', className }) {
  const [failedSrc, setFailedSrc] = useState(null);
  const showImage = Boolean(src) && failedSrc !== src;

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold',
        SIZES[size] ?? SIZES.md,
        !showImage && toneOf(name),
        className,
      )}
    >
      {showImage ? (
        <img
          src={src}
          alt={name}
          className="h-full w-full object-cover"
          onError={() => setFailedSrc(src)}
        />
      ) : (
        <span aria-hidden="true">{initialsOf(name)}</span>
      )}
    </span>
  );
}
