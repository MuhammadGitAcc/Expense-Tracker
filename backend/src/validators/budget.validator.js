'use strict';

const { z } = require('zod');
const { positiveMoney } = require('./account.validator');

const idParamSchema = z.object({ id: z.uuid('Invalid budget id') });

const month = z.number().int().min(1).max(12);
const year = z.number().int().min(2000).max(2100);
const alertThreshold = z.number().int().min(1).max(100);

// strict(): unknown fields (userId ...) are rejected, not silently ignored.
// categoryId left out or null = the overall budget of the month.
const createBudgetSchema = z
  .object({
    categoryId: z.uuid('Invalid category id').nullable().optional(),
    amount: positiveMoney,
    month,
    year,
    alertThreshold: alertThreshold.optional(),
  })
  .strict();

// Only the limit and the alert level can change. Category, month and year cannot.
const updateBudgetSchema = z
  .object({ amount: positiveMoney, alertThreshold })
  .partial()
  .strict()
  .refine((v) => Object.keys(v).length > 0, 'Send at least one field to update');

// ?month=11&year=2026 (each one falls back to the current month / year)
const listBudgetsQuerySchema = z.object({
  month: z.coerce.number().int().min(1).max(12).optional(),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
});

module.exports = {
  idParamSchema,
  createBudgetSchema,
  updateBudgetSchema,
  listBudgetsQuerySchema,
};
