'use strict';

const { z } = require('zod');
const { isoDate } = require('./account.validator');
const { PERIODS, daysBetween } = require('../utils/period');

const MAX_RANGE_DAYS = 366 * 5;

const currency = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{3}$/, 'Currency must be a 3-letter code such as USD');

const periodFields = {
  period: z.enum(PERIODS).optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
  currency: currency.optional(),
};

/**
 * Shared checks for "a period or a date range". Sending from or to without a period means
 * period=custom. A custom period needs both dates, from <= to, at most 5 years.
 */
function withPeriod(shape) {
  return z
    .object({ ...periodFields, ...shape })
    .superRefine((v, ctx) => {
      const period = v.period ?? (v.from || v.to ? 'custom' : 'this_month');
      if (period !== 'custom') {
        if (v.from || v.to) {
          ctx.addIssue({
            code: 'custom',
            path: [v.from ? 'from' : 'to'],
            message: 'from and to can only be used with period=custom',
          });
        }
        return;
      }
      if (!v.from || !v.to) {
        ctx.addIssue({
          code: 'custom',
          path: [v.from ? 'to' : 'from'],
          message: 'A custom period needs both from and to',
        });
        return;
      }
      if (v.from > v.to) {
        ctx.addIssue({ code: 'custom', path: ['to'], message: 'to must not be before from' });
      } else if (daysBetween(v.from, v.to) > MAX_RANGE_DAYS) {
        ctx.addIssue({
          code: 'custom',
          path: ['to'],
          message: 'The date range is too long (5 years at most)',
        });
      }
    })
    .transform((v) => ({
      ...v,
      period: v.period ?? (v.from || v.to ? 'custom' : 'this_month'),
    }));
}

// GET /dashboard/summary?period=this_month&currency=USD
const summaryQuerySchema = withPeriod({});

// GET /dashboard/trends?period=this_year&granularity=month
const trendsQuerySchema = withPeriod({ granularity: z.enum(['day', 'month']).optional() });

// GET /reports/monthly?year=2026&month=11   (both fall back to the current month)
const monthlyReportQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
  currency: currency.optional(),
});

// GET /reports/yearly?year=2026
const yearlyReportQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  currency: currency.optional(),
});

// GET /reports/by-category?from&to&type=expense|income   (from and to are required)
const rangeShape = {
  from: isoDate,
  to: isoDate,
  currency: currency.optional(),
};
const checkRange = (v, ctx) => {
  if (v.from > v.to) {
    ctx.addIssue({ code: 'custom', path: ['to'], message: 'to must not be before from' });
  } else if (daysBetween(v.from, v.to) > MAX_RANGE_DAYS) {
    ctx.addIssue({
      code: 'custom',
      path: ['to'],
      message: 'The date range is too long (5 years at most)',
    });
  }
};
const byCategoryQuerySchema = z
  .object({ ...rangeShape, type: z.enum(['expense', 'income']).default('expense') })
  .superRefine(checkRange);

// GET /reports/by-account?from&to
const byAccountQuerySchema = z.object(rangeShape).superRefine(checkRange);

module.exports = {
  summaryQuerySchema,
  trendsQuerySchema,
  monthlyReportQuerySchema,
  yearlyReportQuerySchema,
  byCategoryQuerySchema,
  byAccountQuerySchema,
};
