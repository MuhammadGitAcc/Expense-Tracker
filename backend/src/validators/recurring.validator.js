'use strict';

const { z } = require('zod');
const { positiveMoney, isoDate } = require('./account.validator');
const { FREQUENCIES, CATEGORY_TYPES } = require('../utils/constants');

const idParamSchema = z.object({ id: z.uuid('Invalid recurring id') });

const uuid = z.uuid('Invalid id');

// Dates are limited to 2000-2100 so the next-run calculation always stays small.
const scheduleDate = isoDate.refine(
  (value) => value >= '2000-01-01' && value <= '2100-12-31',
  'Date must be between 2000 and 2100',
);

// null (or an empty string) clears the value.
const nullableNote = z.union([
  z.null(),
  z
    .string()
    .trim()
    .max(1000)
    .transform((value) => (value === '' ? null : value)),
]);

// strict(): unknown fields (userId, nextRunDate, isActive ...) are rejected, not ignored.
const createRecurringSchema = z
  .object({
    type: z.enum(CATEGORY_TYPES),
    amount: positiveMoney,
    accountId: uuid,
    categoryId: uuid,
    frequency: z.enum(FREQUENCIES),
    startDate: scheduleDate.optional(),
    endDate: scheduleDate.nullable().optional(),
    note: nullableNote.optional(),
  })
  .strict()
  .refine((v) => !v.startDate || !v.endDate || v.startDate <= v.endDate, {
    message: '"endDate" must not be before "startDate"',
    path: ['endDate'],
  });

// Type, frequency and start date cannot change. Delete the template and create a new one.
const updateRecurringSchema = z
  .object({
    amount: positiveMoney,
    accountId: uuid,
    categoryId: uuid,
    endDate: scheduleDate.nullable(),
    note: nullableNote,
  })
  .partial()
  .strict()
  .refine((v) => Object.keys(v).length > 0, 'Send at least one field to update');

// ?type=expense&isActive=true
const listRecurringQuerySchema = z.object({
  type: z.enum(CATEGORY_TYPES).optional(),
  isActive: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional(),
});

module.exports = {
  idParamSchema,
  createRecurringSchema,
  updateRecurringSchema,
  listRecurringQuerySchema,
};
