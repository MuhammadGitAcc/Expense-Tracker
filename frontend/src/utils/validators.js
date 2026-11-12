import { z } from 'zod';
import { isValidISODate } from '@/utils/formatDate';

/**
 * Same rules as the backend validators. Every message is a translation key
 * (see the "validation" section of the i18n files): forms show t(error.message).
 */

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, 'validation.required')
  .max(255, 'validation.emailInvalid')
  .pipe(z.email('validation.emailInvalid'));

export const nameSchema = z
  .string()
  .trim()
  .min(2, 'validation.nameMin')
  .max(100, 'validation.nameMax');

export const loginPasswordSchema = z.string().min(1, 'validation.required').max(200);

export const MAX_PASSWORD_BYTES = 72;

export const PASSWORD_RULES = [
  { key: 'validation.passwordMin', test: (value) => value.length >= 8 },
  { key: 'validation.passwordLower', test: (value) => /[a-z]/.test(value) },
  { key: 'validation.passwordUpper', test: (value) => /[A-Z]/.test(value) },
  { key: 'validation.passwordDigit', test: (value) => /\d/.test(value) },
  { key: 'validation.passwordSpecial', test: (value) => /[^A-Za-z0-9]/.test(value) },
];

const utf8Length = (value) => new TextEncoder().encode(value).length;

/** For a live checklist under the password field: [{ key, ok }]. */
export const getPasswordChecks = (value = '') =>
  PASSWORD_RULES.map(({ key, test }) => ({ key, ok: test(value) }));

export const passwordSchema = PASSWORD_RULES.reduce(
  (schema, { key, test }) => schema.refine(test, key),
  z.string().min(1, 'validation.required'),
).refine((value) => utf8Length(value) <= MAX_PASSWORD_BYTES, 'validation.passwordMax');

/** Adds the "passwords do not match" check to an object schema. */
export function matchPasswords(
  schema,
  { password = 'password', confirm = 'confirmPassword' } = {},
) {
  return schema.refine((data) => data[password] === data[confirm], {
    message: 'validation.passwordsMismatch',
    path: [confirm],
  });
}

const MONEY = /^-?\d{1,10}(\.\d{1,2})?$/;

/** An amount typed by the user: at most 2 decimals, up to 10 digits before the point. */
export const moneySchema = z
  .string()
  .trim()
  .min(1, 'validation.required')
  .regex(MONEY, 'validation.amountFormat');

export const positiveMoneySchema = moneySchema.refine(
  (value) => Number(value) > 0,
  'validation.amountPositive',
);

export const isoDateSchema = z
  .string()
  .trim()
  .min(1, 'validation.required')
  .refine(isValidISODate, 'validation.dateInvalid');

export const currencySchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{3}$/, 'validation.currencyInvalid');

export const verificationCodeSchema = z
  .string()
  .trim()
  .regex(/^\d{6}$/, 'validation.codeFormat');

export const colorSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^#[0-9A-F]{6}$/, 'validation.colorInvalid');

export const textSchema = (max = 500) => z.string().trim().max(max, 'validation.tooLong');
