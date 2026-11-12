import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { z } from 'zod';
import { STORAGE_KEYS } from '@/utils/constants';
import { formatCurrency, formatCompactCurrency, formatPercent } from '@/utils/formatCurrency';
import {
  formatDate,
  formatMonthYear,
  formatRelativeTime,
  parseISODate,
  toISODate,
  monthRange,
} from '@/utils/formatDate';
import { storage } from '@/utils/storage';
import {
  emailSchema,
  passwordSchema,
  moneySchema,
  positiveMoneySchema,
  verificationCodeSchema,
  matchPasswords,
} from '@/utils/validators';
import { useToast, toast } from '@/hooks/useToast';
import { useTheme } from '@/hooks/useTheme';

describe('formatCurrency', () => {
  it('formats API strings', () => {
    expect(formatCurrency('12.5', 'USD', 'en')).toBe('$12.50');
    expect(formatCurrency('-49.9', 'USD', 'en')).toBe('-$49.90');
  });

  it('shows a dash when there is no number', () => {
    expect(formatCurrency('abc')).toBe('—');
    expect(formatCurrency(null)).toBe('—');
    expect(formatCurrency('')).toBe('—');
  });

  it('falls back for an invalid currency code', () => {
    expect(formatCurrency('12.5', 'ABCD')).toBe('12.50 ABCD');
  });

  it('uses Latin digits in Arabic', () => {
    expect(formatCurrency('1234.5', 'SAR', 'ar')).toMatch(/1,234\.50/);
  });

  it('formats compact amounts and percentages', () => {
    expect(formatCompactCurrency('12500', 'USD', 'en')).toBe('$12.5K');
    expect(formatPercent(12.5, 'en')).toBe('12.5%');
    expect(formatPercent(null, 'en')).toBe('—');
  });
});

describe('formatDate', () => {
  it('formats a calendar day without shifting it', () => {
    expect(formatDate('2026-01-01', 'en')).toBe('Jan 1, 2026');
    expect(formatDate('2026-02-31', 'en')).toBe('—');
  });

  it('parses only real calendar days', () => {
    expect(parseISODate('2026-02-31')).toBeNull();
    expect(parseISODate('2026-11-12').toISOString()).toBe('2026-11-12T00:00:00.000Z');
  });

  it('builds ISO dates and month ranges', () => {
    expect(toISODate(new Date(2026, 10, 5))).toBe('2026-11-05');
    expect(monthRange(2028, 2)).toEqual({ from: '2028-02-01', to: '2028-02-29' });
    expect(formatMonthYear(2026, 11, 'en')).toBe('November 2026');
  });

  it('formats relative times', () => {
    const now = Date.UTC(2026, 10, 12, 12, 0, 0);
    expect(formatRelativeTime(new Date(now - 5 * 60 * 1000).toISOString(), 'en', now)).toBe(
      '5 minutes ago',
    );
    expect(formatRelativeTime(new Date(now).toISOString(), 'en', now)).toBe('now');
    expect(formatRelativeTime(new Date(now - 86400000).toISOString(), 'en', now)).toBe('yesterday');
  });
});

describe('storage', () => {
  beforeEach(() => localStorage.clear());

  it('stores and reads JSON', () => {
    storage.set('k', { a: 1 });
    expect(storage.get('k')).toEqual({ a: 1 });
    storage.remove('k');
    expect(storage.get('k', 'fallback')).toBe('fallback');
  });

  it('returns the fallback for broken JSON', () => {
    localStorage.setItem('bad', '{');
    expect(storage.get('bad', 'fallback')).toBe('fallback');
  });
});

describe('validators', () => {
  it('cleans and checks emails', () => {
    expect(emailSchema.parse('  ANN@Test.com ')).toBe('ann@test.com');
    const result = emailSchema.safeParse('nope');
    expect(result.error.issues[0].message).toBe('validation.emailInvalid');
  });

  it('checks every password rule', () => {
    expect(passwordSchema.safeParse('Abcdef1!').success).toBe(true);

    const weak = passwordSchema.safeParse('abcdefgh');
    const messages = weak.error.issues.map((issue) => issue.message);
    expect(messages).toEqual(
      expect.arrayContaining([
        'validation.passwordUpper',
        'validation.passwordDigit',
        'validation.passwordSpecial',
      ]),
    );

    const long = passwordSchema.safeParse(`Aa1!${'x'.repeat(69)}`);
    expect(long.error.issues.map((issue) => issue.message)).toContain('validation.passwordMax');
  });

  it.each(['12.50', '-3', '0.5', '1234567890.99'])('accepts the amount %s', (value) => {
    expect(moneySchema.safeParse(value).success).toBe(true);
  });

  it.each(['12.505', '1e5', '', '12,50', 'abc'])('rejects the amount "%s"', (value) => {
    expect(moneySchema.safeParse(value).success).toBe(false);
  });

  it('requires a positive amount where needed', () => {
    expect(positiveMoneySchema.safeParse('0.01').success).toBe(true);
    expect(positiveMoneySchema.safeParse('0').success).toBe(false);
    expect(positiveMoneySchema.safeParse('-5').success).toBe(false);
  });

  it('checks the 6 digit code', () => {
    expect(verificationCodeSchema.safeParse('042917').success).toBe(true);
    expect(verificationCodeSchema.safeParse('12345').success).toBe(false);
  });

  it('checks that two passwords match', () => {
    const schema = matchPasswords(z.object({ password: z.string(), confirmPassword: z.string() }));
    expect(schema.safeParse({ password: 'a', confirmPassword: 'a' }).success).toBe(true);

    const result = schema.safeParse({ password: 'a', confirmPassword: 'b' });
    expect(result.error.issues[0].path).toEqual(['confirmPassword']);
    expect(result.error.issues[0].message).toBe('validation.passwordsMismatch');
  });
});

describe('useToast', () => {
  afterEach(() => {
    vi.useRealTimers();
    act(() => toast.clear());
  });

  it('adds a toast and removes it after its time', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.toast.success('Saved');
    });
    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0]).toMatchObject({ type: 'success', message: 'Saved' });

    act(() => {
      vi.advanceTimersByTime(4000);
    });
    expect(result.current.toasts).toHaveLength(0);
  });

  it('keeps at most 5 toasts and can dismiss one', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      for (let i = 1; i <= 6; i += 1) result.current.toast.info(`Toast ${i}`, { durationMs: 0 });
    });
    expect(result.current.toasts).toHaveLength(5);
    expect(result.current.toasts[0].message).toBe('Toast 2');

    act(() => {
      result.current.dismiss(result.current.toasts[0].id);
    });
    expect(result.current.toasts).toHaveLength(4);
  });
});

describe('useTheme', () => {
  afterEach(() => {
    const { result } = renderHook(() => useTheme());
    act(() => result.current.setTheme('system'));
    localStorage.clear();
  });

  it('applies and stores the chosen theme', () => {
    const { result } = renderHook(() => useTheme());

    act(() => result.current.setTheme('dark'));
    expect(result.current.theme).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(storage.get(STORAGE_KEYS.theme)).toBe('dark');

    act(() => result.current.setTheme('light'));
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('ignores an unknown theme and can toggle', () => {
    const { result } = renderHook(() => useTheme());

    act(() => result.current.setTheme('light'));
    act(() => result.current.setTheme('purple'));
    expect(result.current.theme).toBe('light');

    act(() => result.current.toggleTheme());
    expect(result.current.theme).toBe('dark');
  });
});
