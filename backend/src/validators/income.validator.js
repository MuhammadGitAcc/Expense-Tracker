'use strict';

const { z } = require('zod');
const { money, positiveMoney, isoDate } = require('./account.validator');

const idParamSchema = z.object({ id: z.uuid('Invalid income id') });

const uuid = z.uuid('Invalid id');

// null (or an empty string) clears the value.
const nullableText = (max) =>
  z.union([
    z.null(),
    z
      .string()
      .trim()
      .max(max)
      .transform((value) => (value === '' ? null : value)),
  ]);

const fields = {
  accountId: uuid,
  categoryId: uuid,
  amount: positiveMoney,
  date: isoDate,
  source: nullableText(150),
  note: nullableText(1000),
};

// strict(): unknown fields (userId, recurringId ...) are rejected, not silently ignored.
const createIncomeSchema = z
  .object({
    accountId: fields.accountId,
    categoryId: fields.categoryId,
    amount: fields.amount,
    date: fields.date.optional(),
    source: fields.source.optional(),
    note: fields.note.optional(),
  })
  .strict();

const updateIncomeSchema = z
  .object(fields)
  .partial()
  .strict()
  .refine((v) => Object.keys(v).length > 0, 'Send at least one field to update');

const SORT_FIELDS = ['date', 'amount', 'createdAt'];

const listIncomesQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    search: z.string().trim().min(1).max(100).optional(),
    from: isoDate.optional(),
    to: isoDate.optional(),
    categoryId: uuid.optional(),
    accountId: uuid.optional(),
    minAmount: money.optional(),
    maxAmount: money.optional(),
    sortBy: z.enum(SORT_FIELDS).default('date'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
  })
  .refine((v) => !v.from || !v.to || v.from <= v.to, {
    message: '"from" must not be after "to"',
    path: ['from'],
  })
  .refine(
    (v) =>
      v.minAmount === undefined ||
      v.maxAmount === undefined ||
      Number(v.minAmount) <= Number(v.maxAmount),
    { message: '"minAmount" must not be greater than "maxAmount"', path: ['minAmount'] },
  );

module.exports = {
  idParamSchema,
  createIncomeSchema,
  updateIncomeSchema,
  listIncomesQuerySchema,
};
