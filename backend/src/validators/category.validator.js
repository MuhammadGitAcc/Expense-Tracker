'use strict';

const { z } = require('zod');
const { CATEGORY_TYPES } = require('../utils/constants');

const idParamSchema = z.object({ id: z.uuid('Invalid category id') });

const name = z.string().trim().min(1, 'Name is required').max(60);
const icon = z
  .string()
  .trim()
  .toLowerCase()
  .max(50)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Icon must be a name such as "shopping-bag"');
const color = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^#[0-9A-F]{6}$/, 'Color must look like #1A2B3C');

// ?type=income|expense (optional)
const listCategoriesQuerySchema = z.object({ type: z.enum(CATEGORY_TYPES).optional() });

// Same defaults as the database columns. strict(): unknown fields such as isDefault or
// userId are rejected instead of silently ignored.
const createCategorySchema = z
  .object({
    name,
    type: z.enum(CATEGORY_TYPES),
    icon: icon.default('tag'),
    color: color.default('#6B7280'),
  })
  .strict();

// type is NOT here on purpose: a category never changes between income and expense.
const updateCategorySchema = z
  .object({ name, icon, color })
  .partial()
  .strict()
  .refine((v) => Object.keys(v).length > 0, 'Send at least one field to update');

module.exports = {
  idParamSchema,
  listCategoriesQuerySchema,
  createCategorySchema,
  updateCategorySchema,
};
