'use strict';

const db = require('../../src/config/db');
const cleanupService = require('../../src/services/cleanup.service');
const passwordResetTokenRepository = require('../../src/repositories/passwordResetToken.repository');
const { registerUser, registerUnverified, resetDatabase, closeDatabase } = require('../helpers');

beforeEach(async () => {
  await resetDatabase();
});
afterAll(async () => {
  await closeDatabase();
});

const count = async (table, where = 'TRUE', values = []) =>
  (await db.query(`SELECT COUNT(*)::int AS n FROM ${table} WHERE ${where}`, values)).rows[0].n;

const emailExists = async (email) => (await count('users', 'email = $1', [email])) === 1;

/** Pretend the sign-up (and its verification code) happened `days` days ago. */
async function ageSignUp(email, days) {
  await db.query(
    `UPDATE users SET created_at = NOW() - ($2::int * INTERVAL '1 day') WHERE email = $1`,
    [email, days],
  );
  await db.query(
    `UPDATE email_verification_codes SET created_at = NOW() - ($2::int * INTERVAL '1 day')
     WHERE user_id = (SELECT id FROM users WHERE email = $1)`,
    [email, days],
  );
}

describe('unverified accounts', () => {
  it('deletes sign-ups that stayed unverified for more than 3 days, with their codes', async () => {
    await registerUnverified({ email: 'old@example.com' });
    await ageSignUp('old@example.com', 4);

    const result = await cleanupService.runCleanup();

    expect(result.unverifiedAccounts).toBe(1);
    expect(await emailExists('old@example.com')).toBe(false);
    expect(await count('email_verification_codes')).toBe(0);
  });

  it('keeps a recent unverified sign-up', async () => {
    await registerUnverified({ email: 'new@example.com' });
    await ageSignUp('new@example.com', 1);

    const result = await cleanupService.runCleanup();

    expect(result.unverifiedAccounts).toBe(0);
    expect(await emailExists('new@example.com')).toBe(true);
  });

  it('keeps an old account that asked for a new code recently (still trying)', async () => {
    await registerUnverified({ email: 'retry@example.com' });
    await db.query(`UPDATE users SET created_at = NOW() - INTERVAL '10 days'`);
    await db.query(`UPDATE email_verification_codes SET created_at = NOW() - INTERVAL '1 day'`);

    const result = await cleanupService.runCleanup();

    expect(result.unverifiedAccounts).toBe(0);
    expect(await emailExists('retry@example.com')).toBe(true);
  });

  it('never deletes a verified account, however old', async () => {
    const { user } = await registerUser({ email: 'verified@example.com' });
    await db.query(`UPDATE users SET created_at = NOW() - INTERVAL '400 days' WHERE id = $1`, [
      user.id,
    ]);

    const result = await cleanupService.runCleanup();

    expect(result.unverifiedAccounts).toBe(0);
    expect(await emailExists('verified@example.com')).toBe(true);
  });

  it('never deletes an unverified user that owns an account (safety net)', async () => {
    await registerUnverified({ email: 'strange@example.com' });
    await ageSignUp('strange@example.com', 30);
    await db.query(
      `INSERT INTO accounts (user_id, name, balance, currency)
       VALUES ((SELECT id FROM users WHERE email = 'strange@example.com'), 'Wallet', 10, 'USD')`,
    );

    const result = await cleanupService.runCleanup();

    expect(result.unverifiedAccounts).toBe(0);
    expect(await emailExists('strange@example.com')).toBe(true);
  });
});

describe('expired tokens and codes', () => {
  it('deletes the expired ones and keeps the valid ones', async () => {
    const { user } = await registerUser({ email: 'a@example.com' }); // has one valid refresh token
    await db.query(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES
         ($1, 'expired-refresh', NOW() - INTERVAL '1 minute'),
         ($1, 'valid-refresh',   NOW() + INTERVAL '1 day')`,
      [user.id],
    );
    await db.query(
      `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES
         ($1, 'expired-reset', NOW() - INTERVAL '1 minute'),
         ($1, 'valid-reset',   NOW() + INTERVAL '10 minutes')`,
      [user.id],
    );
    await db.query(
      `INSERT INTO email_verification_codes (user_id, code_hash, expires_at) VALUES
         ($1, 'expired-code', NOW() - INTERVAL '1 minute'),
         ($1, 'valid-code',   NOW() + INTERVAL '10 minutes')`,
      [user.id],
    );
    const refreshBefore = await count('refresh_tokens');
    const codesBefore = await count('email_verification_codes');

    const result = await cleanupService.runCleanup();

    expect(result).toMatchObject({
      verificationCodes: 1,
      passwordResetTokens: 1,
      refreshTokens: 1,
      failed: 0,
    });
    expect(await count('refresh_tokens')).toBe(refreshBefore - 1);
    expect(await count('refresh_tokens', "token_hash = 'valid-refresh'")).toBe(1);
    expect(await count('password_reset_tokens', "token_hash = 'valid-reset'")).toBe(1);
    expect(await count('password_reset_tokens', "token_hash = 'expired-reset'")).toBe(0);
    expect(await count('email_verification_codes')).toBe(codesBefore - 1);
  });

  it('keeps a revoked token until it expires (needed to spot a stolen token)', async () => {
    const { user } = await registerUser({ email: 'b@example.com' });
    await db.query(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at, revoked)
       VALUES ($1, 'revoked-but-valid', NOW() + INTERVAL '1 day', TRUE)`,
      [user.id],
    );

    await cleanupService.runCleanup();

    expect(await count('refresh_tokens', "token_hash = 'revoked-but-valid'")).toBe(1);
  });
});

describe('runCleanup', () => {
  it('does nothing the second time', async () => {
    await registerUnverified({ email: 'old@example.com' });
    await ageSignUp('old@example.com', 5);
    await cleanupService.runCleanup();

    const second = await cleanupService.runCleanup();

    expect(second).toEqual({
      unverifiedAccounts: 0,
      verificationCodes: 0,
      passwordResetTokens: 0,
      refreshTokens: 0,
      failed: 0,
    });
  });

  it('keeps going when one step fails', async () => {
    const { user } = await registerUser({ email: 'c@example.com' });
    await db.query(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
       VALUES ($1, 'expired-refresh', NOW() - INTERVAL '1 minute')`,
      [user.id],
    );
    const spy = jest
      .spyOn(passwordResetTokenRepository, 'deleteExpired')
      .mockRejectedValue(new Error('boom'));
    try {
      const result = await cleanupService.runCleanup();

      expect(result).toMatchObject({ passwordResetTokens: 0, refreshTokens: 1, failed: 1 });
    } finally {
      spy.mockRestore();
    }
  });
});
