'use strict';

const { z } = require('zod');
const { PAYMENT_METHODS } = require('../utils/constants');
const { money, positiveMoney, isoDate } = require('./account.validator');

const idParamSchema = z.object({ id: z.uuid('Invalid expense id') });

const uuid = z.uuid('Invalid id');

// Tags: trimmed, lower-case, at most 30 characters, at most 10 per expense, no duplicates.
const tag = z.string().trim().toLowerCase().min(1, 'A tag cannot be empty').max(30);
const tags = z
  .array(tag)
  .max(10, 'At most 10 tags')
  .transform((list) => [...new Set(list)]);

// null (or an empty string) clears the note.
const note = z.union([
  z.null(),
  z
    .string()
    .trim()
    .max(1000)
    .transform((value) => (value === '' ? null : value)),
]);

const fields = {
  accountId: uuid,
  categoryId: uuid,
  amount: positiveMoney,
  date: isoDate,
  note,
  paymentMethod: z.enum(PAYMENT_METHODS),
  tags,
};

// strict(): unknown fields (userId, receiptUrl ...) are rejected, not silently ignored.
const createExpenseSchema = z
  .object({
    accountId: fields.accountId,
    categoryId: fields.categoryId,
    amount: fields.amount,
    date: fields.date.optional(),
    note: fields.note.optional(),
    paymentMethod: fields.paymentMethod.default('cash'),
    tags: fields.tags.default([]),
  })
  .strict();

const updateExpenseSchema = z
  .object(fields)
  .partial()
  .strict()
  .refine((v) => Object.keys(v).length > 0, 'Send at least one field to update');

const SORT_FIELDS = ['date', 'amount', 'createdAt'];

const listExpensesQuerySchema = z
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
    tag: tag.optional(),
    paymentMethod: z.enum(PAYMENT_METHODS).optional(),
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
  createExpenseSchema,
  updateExpenseSchema,
  listExpensesQuerySchema,
};
