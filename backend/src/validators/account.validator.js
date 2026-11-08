'use strict';

const { z } = require('zod');
const { ACCOUNT_TYPES } = require('../utils/constants');
const { isValidISODate } = require('../utils/dateHelpers');

const idParamSchema = z.object({ id: z.uuid('Invalid account id') });

/**
 * Money: a number or a numeric string with at most 2 decimals (12, "12.5", -3.99). It is
 * turned into a STRING and goes to PostgreSQL as is, so no float rounding can happen.
 * NUMERIC(12,2) allows up to 10 digits before the point.
 */
const money = z
  .union([z.number(), z.string()])
  .transform((value) => String(value).trim())
  .pipe(
    z
      .string()
      .regex(
        /^-?\d{1,10}(\.\d{1,2})?$/,
        'Enter an amount with at most 2 decimals and up to 10 digits before the point',
      ),
  );
const positiveMoney = money.refine((value) => Number(value) > 0, 'Amount must be greater than 0');

const name = z.string().trim().min(1, 'Name is required').max(100);
const type = z.enum(ACCOUNT_TYPES);
const currency = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{3}$/, 'Currency must be a 3-letter code such as USD');
const color = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^#[0-9A-F]{6}$/, 'Color must look like #1A2B3C');

// ?includeArchived=true
const listAccountsQuerySchema = z.object({
  includeArchived: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional(),
});

// strict(): unknown fields (isArchived, userId ...) are rejected, not silently ignored.
// currency is optional here: the service falls back to the user's profile currency.
const createAccountSchema = z
  .object({
    name,
    type: type.default('cash'),
    balance: money.default('0'),
    currency: currency.optional(),
    color: color.default('#3B82F6'),
  })
  .strict();

// balance and currency are NOT here on purpose: balances change only through
// transactions and transfers, and the currency never changes.
const updateAccountSchema = z
  .object({ name, type, color })
  .partial()
  .strict()
  .refine((v) => Object.keys(v).length > 0, 'Send at least one field to update');

const isoDate = z.string().trim().refine(isValidISODate, 'Date must look like 2026-11-08');

const transferSchema = z
  .object({
    fromAccountId: z.uuid('Invalid account id'),
    toAccountId: z.uuid('Invalid account id'),
    amount: positiveMoney,
    date: isoDate.optional(),
    note: z.string().trim().max(500).optional(),
  })
  .strict()
  .refine((v) => v.fromAccountId !== v.toAccountId, {
    message: 'Choose two different accounts',
    path: ['toAccountId'],
  });

const listTransfersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

module.exports = {
  money,
  positiveMoney,
  isoDate,
  idParamSchema,
  listAccountsQuerySchema,
  createAccountSchema,
  updateAccountSchema,
  transferSchema,
  listTransfersQuerySchema,
};
