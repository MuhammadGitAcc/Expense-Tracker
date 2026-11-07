'use strict';

const path = require('path');
const { z } = require('zod');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env'), quiet: true });

const bool = z.enum(['true', 'false']).transform((v) => v === 'true');
const secret = z
  .string()
  .min(32, 'must be at least 32 characters')
  .refine((v) => !v.startsWith('replace_with'), 'is still the placeholder from .env.example');

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(5000),
  API_PREFIX: z
    .string()
    .regex(/^\/[a-z0-9/_-]*$/i, 'must start with "/"')
    .default('/api/v1'),

  DATABASE_URL: z.string().min(1, 'is required'),
  DB_POOL_MAX: z.coerce.number().int().min(1).max(100).default(10),

  JWT_ACCESS_SECRET: secret,
  JWT_REFRESH_SECRET: secret,
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_DAYS: z.coerce.number().int().min(1).default(7),

  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  FRONTEND_URL: z.string().default('http://localhost:5173'),
  COOKIE_SECURE: bool.default(false),

  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(1000).default(900000),
  RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(300),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(10),

  UPLOAD_DIR: z.string().default('uploads'),
  MAX_UPLOAD_MB: z.coerce.number().min(0.1).default(5),

  // Email is only needed from Phase 3, so these stay optional for now.
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  EMAIL_FROM: z.string().optional(),

  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'http', 'debug']).default('debug'),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  // Fail fast with a readable list. The logger is not loaded yet, so use stderr directly.
  const lines = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`);
  process.stderr.write(
    `Invalid environment configuration (check backend/.env):\n${lines.join('\n')}\n`,
  );
  process.exit(1);
}

const e = parsed.data;

module.exports = Object.freeze({
  nodeEnv: e.NODE_ENV,
  isProduction: e.NODE_ENV === 'production',
  isTest: e.NODE_ENV === 'test',
  port: e.PORT,
  apiPrefix: e.API_PREFIX.replace(/\/$/, ''),
  db: { url: e.DATABASE_URL, poolMax: e.DB_POOL_MAX },
  jwt: {
    accessSecret: e.JWT_ACCESS_SECRET,
    refreshSecret: e.JWT_REFRESH_SECRET,
    accessExpiresIn: e.JWT_ACCESS_EXPIRES_IN,
    refreshExpiresDays: e.JWT_REFRESH_EXPIRES_DAYS,
  },
  corsOrigins: e.CORS_ORIGIN.split(',')
    .map((o) => o.trim())
    .filter(Boolean),
  frontendUrl: e.FRONTEND_URL,
  cookieSecure: e.COOKIE_SECURE,
  rateLimit: {
    windowMs: e.RATE_LIMIT_WINDOW_MS,
    max: e.RATE_LIMIT_MAX,
    authMax: e.AUTH_RATE_LIMIT_MAX,
  },
  upload: { dir: e.UPLOAD_DIR, maxMb: e.MAX_UPLOAD_MB },
  smtp: {
    host: e.SMTP_HOST,
    port: e.SMTP_PORT,
    user: e.SMTP_USER,
    pass: e.SMTP_PASS,
    from: e.EMAIL_FROM,
  },
  logLevel: e.LOG_LEVEL,
});
