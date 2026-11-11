'use strict';

const { z } = require('zod');
const { PAYMENT_METHODS } = require('../utils/constants');
const { money, isoDate } = require('./account.validator');

const EXPORT_FORMATS = ['csv', 'xlsx', 'pdf'];

const uuid = z.uuid('Invalid id');
const tag = z.string().trim().toLowerCase().min(1).max(30);

// The same filters as GET /expenses (without page and limit: an export has every match).
// ?format=csv|xlsx|pdf (csv when left out).
const exportExpensesQuerySchema = z
  .object({
    format: z.enum(EXPORT_FORMATS).default('csv'),
    search: z.string().trim().min(1).max(100).optional(),
    from: isoDate.optional(),
    to: isoDate.optional(),
    categoryId: uuid.optional(),
    accountId: uuid.optional(),
    minAmount: money.optional(),
    maxAmount: money.optional(),
    tag: tag.optional(),
    paymentMethod: z.enum(PAYMENT_METHODS).optional(),
    sortBy: z.enum(['date', 'amount', 'createdAt']).default('date'),
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

module.exports = { EXPORT_FORMATS, exportExpensesQuerySchema };
