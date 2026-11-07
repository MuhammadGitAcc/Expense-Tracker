'use strict';

const { z } = require('zod');

const email = z.string().trim().toLowerCase().max(255).pipe(z.email('Enter a valid email address'));

/**
 * Strong password rules. The 72-byte limit is a bcrypt limit: bcrypt silently ignores
 * everything after byte 72, so longer passwords are rejected instead of truncated.
 */
const password = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .refine((v) => Buffer.byteLength(v, 'utf8') <= 72, 'Password must be at most 72 bytes')
  .refine((v) => /[a-z]/.test(v), 'Password must contain a lowercase letter')
  .refine((v) => /[A-Z]/.test(v), 'Password must contain an uppercase letter')
  .refine((v) => /\d/.test(v), 'Password must contain a number')
  .refine((v) => /[^A-Za-z0-9]/.test(v), 'Password must contain a special character');

const name = z.string().trim().min(2, 'Name must be at least 2 characters').max(100);

const registerSchema = z.object({
  name,
  email,
  password,
});

// Login does not apply the strength rules: it only checks that something was sent.
const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Password is required').max(200),
});

const forgotPasswordSchema = z.object({ email });

const resetPasswordSchema = z.object({
  token: z.string().trim().min(20, 'Invalid reset token').max(200),
  password,
});

module.exports = {
  passwordSchema: password,
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
};
