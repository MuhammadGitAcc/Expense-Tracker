'use strict';

const { z } = require('zod');
const { THEMES, LANGUAGES } = require('../utils/constants');
const { passwordSchema } = require('./auth.validator');

// PUT /users/me: send only the fields you want to change, at least one.
const updateProfileSchema = z
  .object({
    name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100),
    currency: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{3}$/, 'Currency must be a 3-letter code such as USD'),
    language: z.enum(LANGUAGES),
    theme: z.enum(THEMES),
  })
  .partial()
  .strict()
  .refine((v) => Object.keys(v).length > 0, 'Send at least one field to update');

// PUT /users/me/password
const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required').max(200),
    newPassword: passwordSchema,
  })
  .refine((v) => v.currentPassword !== v.newPassword, {
    message: 'New password must be different from the current password',
    path: ['newPassword'],
  });

// DELETE /users/me: the password confirms it is really the owner deleting the account.
const deleteAccountSchema = z.object({
  password: z.string().min(1, 'Password is required').max(200),
});

module.exports = { updateProfileSchema, changePasswordSchema, deleteAccountSchema };
