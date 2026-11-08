'use strict';

jest.mock('../../src/config/db', () => ({ withTransaction: jest.fn() }));
jest.mock('../../src/repositories/user.repository');
jest.mock('../../src/repositories/refreshToken.repository');
jest.mock('../../src/repositories/passwordResetToken.repository');
jest.mock('../../src/repositories/emailVerificationCode.repository');
jest.mock('../../src/services/email.service');
jest.mock('../../src/utils/hash');
jest.mock('../../src/utils/jwt');

const db = require('../../src/config/db');
const ApiError = require('../../src/utils/ApiError');
const userRepository = require('../../src/repositories/user.repository');
const refreshTokenRepository = require('../../src/repositories/refreshToken.repository');
const passwordResetTokenRepository = require('../../src/repositories/passwordResetToken.repository');
const emailVerificationCodeRepository = require('../../src/repositories/emailVerificationCode.repository');
const emailService = require('../../src/services/email.service');
const hash = require('../../src/utils/hash');
const jwt = require('../../src/utils/jwt');
const authService = require('../../src/services/auth.service');

const CLIENT = { name: 'transaction-client' };
const USER = {
  id: 'user-1',
  name: 'Test User',
  email: 'test@example.com',
  role: 'user',
  emailVerified: true,
};
const PENDING = { ...USER, emailVerified: false };
const EXPIRES_AT = new Date('2030-01-01T00:00:00Z');

beforeEach(() => {
  jest.resetAllMocks();
  db.withTransaction.mockImplementation((callback) => callback(CLIENT));
  hash.hashPassword.mockResolvedValue('hashed-password');
  hash.comparePassword.mockResolvedValue(true);
  hash.hashToken.mockImplementation((token) => `hash:${token}`);
  hash.generateRandomToken.mockReturnValue('random-reset-token');
  jwt.signAccessToken.mockReturnValue('access-token');
  jwt.signRefreshToken.mockReturnValue({ token: 'refresh-token', expiresAt: EXPIRES_AT });
  jwt.verifyRefreshToken.mockReturnValue({ sub: USER.id });
  emailService.sendWelcomeEmail.mockResolvedValue(true);
  emailService.sendPasswordResetEmail.mockResolvedValue(true);
  emailService.sendVerificationEmail.mockResolvedValue(true);
  hash.generateVerificationCode.mockReturnValue('123456');
  hash.hashVerificationCode.mockImplementation((userId, code) => `vhash:${userId}:${code}`);
  hash.verifyVerificationCode.mockImplementation(
    (userId, code, stored) => stored === `vhash:${userId}:${code}`,
  );
  emailVerificationCodeRepository.secondsSinceLastCode.mockResolvedValue(null);
});

describe('register', () => {
  const input = { name: 'Test User', email: 'test@example.com', password: 'Test@12345' };

  it('rejects an email that belongs to a verified account', async () => {
    userRepository.findByEmail.mockResolvedValue(USER);

    await expect(authService.register(input)).rejects.toMatchObject({ statusCode: 409 });
    expect(userRepository.create).not.toHaveBeenCalled();
    expect(emailService.sendVerificationEmail).not.toHaveBeenCalled();
  });

  it('creates an unverified user, stores a hashed code, emails it and logs nobody in', async () => {
    userRepository.findByEmail.mockResolvedValue(null);
    userRepository.create.mockResolvedValue(PENDING);

    const result = await authService.register(input);

    expect(userRepository.create).toHaveBeenCalledWith({
      name: input.name,
      email: input.email,
      passwordHash: 'hashed-password',
    });
    expect(emailVerificationCodeRepository.invalidateAllForUser).toHaveBeenCalledWith(
      PENDING.id,
      CLIENT,
    );
    expect(emailVerificationCodeRepository.create).toHaveBeenCalledWith(
      { userId: PENDING.id, codeHash: `vhash:${PENDING.id}:123456`, expiresAt: expect.any(Date) },
      CLIENT,
    );
    expect(emailService.sendVerificationEmail).toHaveBeenCalledWith({
      user: PENDING,
      code: '123456',
      expiresInMinutes: 10,
    });
    expect(refreshTokenRepository.create).not.toHaveBeenCalled();
    expect(emailService.sendWelcomeEmail).not.toHaveBeenCalled();
    expect(result).toEqual({ user: PENDING, expiresInMinutes: 10 });
  });

  it('takes over an account that was never verified instead of failing', async () => {
    userRepository.findByEmail.mockResolvedValue(PENDING);
    userRepository.updateProfile.mockResolvedValue(PENDING);

    await authService.register(input);

    expect(userRepository.create).not.toHaveBeenCalled();
    expect(userRepository.updatePassword).toHaveBeenCalledWith(
      PENDING.id,
      'hashed-password',
      CLIENT,
    );
    expect(userRepository.updateProfile).toHaveBeenCalledWith(
      PENDING.id,
      { name: input.name },
      CLIENT,
    );
    expect(emailService.sendVerificationEmail).toHaveBeenCalledTimes(1);
  });

  it('does not create a second code inside the resend cooldown', async () => {
    userRepository.findByEmail.mockResolvedValue(PENDING);
    userRepository.updateProfile.mockResolvedValue(PENDING);
    emailVerificationCodeRepository.secondsSinceLastCode.mockResolvedValue(10);

    await authService.register(input);

    expect(emailVerificationCodeRepository.create).not.toHaveBeenCalled();
    expect(emailService.sendVerificationEmail).not.toHaveBeenCalled();
  });
});

describe('verifyEmail', () => {
  const input = { email: PENDING.email, code: '123456' };
  const activeCode = (code = '123456', attempts = 0) => ({
    id: 'code-1',
    codeHash: `vhash:${PENDING.id}:${code}`,
    attempts,
  });

  it('gives the same 400 for an unknown email', async () => {
    userRepository.findByEmail.mockResolvedValue(null);

    await expect(authService.verifyEmail(input)).rejects.toMatchObject({
      statusCode: 400,
      message: 'This code is invalid or has expired',
    });
    expect(emailVerificationCodeRepository.findActiveByUserId).not.toHaveBeenCalled();
  });

  it('rejects an account that is already verified', async () => {
    userRepository.findByEmail.mockResolvedValue(USER);

    await expect(authService.verifyEmail(input)).rejects.toMatchObject({ statusCode: 400 });
    expect(emailVerificationCodeRepository.findActiveByUserId).not.toHaveBeenCalled();
  });

  it('rejects when there is no active code', async () => {
    userRepository.findByEmail.mockResolvedValue(PENDING);
    emailVerificationCodeRepository.findActiveByUserId.mockResolvedValue(null);

    await expect(authService.verifyEmail(input)).rejects.toMatchObject({
      statusCode: 400,
      message: 'This code is invalid or has expired',
    });
  });

  it('counts a wrong code and says how many attempts are left', async () => {
    userRepository.findByEmail.mockResolvedValue(PENDING);
    emailVerificationCodeRepository.findActiveByUserId.mockResolvedValue(activeCode('999999'));
    emailVerificationCodeRepository.registerFailedAttempt.mockResolvedValue(1);

    await expect(authService.verifyEmail(input)).rejects.toMatchObject({
      statusCode: 400,
      message: 'Incorrect code. 4 attempt(s) left',
    });
    expect(emailVerificationCodeRepository.registerFailedAttempt).toHaveBeenCalledWith('code-1', 5);
    expect(emailVerificationCodeRepository.markUsed).not.toHaveBeenCalled();
    expect(refreshTokenRepository.create).not.toHaveBeenCalled();
  });

  it('says to request a new code after the last allowed wrong attempt', async () => {
    userRepository.findByEmail.mockResolvedValue(PENDING);
    emailVerificationCodeRepository.findActiveByUserId.mockResolvedValue(activeCode('999999', 4));
    emailVerificationCodeRepository.registerFailedAttempt.mockResolvedValue(5);

    await expect(authService.verifyEmail(input)).rejects.toMatchObject({
      statusCode: 400,
      message: expect.stringContaining('Too many wrong attempts'),
    });
  });

  it('verifies the email, logs the user in and sends the welcome email', async () => {
    userRepository.findByEmail.mockResolvedValue(PENDING);
    emailVerificationCodeRepository.findActiveByUserId.mockResolvedValue(activeCode());
    emailVerificationCodeRepository.markUsed.mockResolvedValue(true);

    const result = await authService.verifyEmail(input);

    expect(emailVerificationCodeRepository.markUsed).toHaveBeenCalledWith('code-1', 5, CLIENT);
    expect(userRepository.markEmailVerified).toHaveBeenCalledWith(PENDING.id, CLIENT);
    expect(refreshTokenRepository.create).toHaveBeenCalledWith(
      { userId: PENDING.id, tokenHash: 'hash:refresh-token', expiresAt: EXPIRES_AT },
      CLIENT,
    );
    expect(emailService.sendWelcomeEmail).toHaveBeenCalledWith({ ...PENDING, emailVerified: true });
    expect(result).toEqual({
      user: { ...PENDING, emailVerified: true },
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    });
  });

  it('rejects a correct code that was used up in the meantime', async () => {
    userRepository.findByEmail.mockResolvedValue(PENDING);
    emailVerificationCodeRepository.findActiveByUserId.mockResolvedValue(activeCode());
    emailVerificationCodeRepository.markUsed.mockResolvedValue(false);

    await expect(authService.verifyEmail(input)).rejects.toMatchObject({ statusCode: 400 });
    expect(userRepository.markEmailVerified).not.toHaveBeenCalled();
    expect(refreshTokenRepository.create).not.toHaveBeenCalled();
  });
});

describe('resendVerification', () => {
  it('does nothing for an unknown email', async () => {
    userRepository.findByEmail.mockResolvedValue(null);

    await authService.resendVerification({ email: 'nobody@example.com' });

    expect(emailService.sendVerificationEmail).not.toHaveBeenCalled();
  });

  it('does nothing for an account that is already verified', async () => {
    userRepository.findByEmail.mockResolvedValue(USER);

    await authService.resendVerification({ email: USER.email });

    expect(emailService.sendVerificationEmail).not.toHaveBeenCalled();
  });

  it('does nothing inside the 60 second cooldown', async () => {
    userRepository.findByEmail.mockResolvedValue(PENDING);
    emailVerificationCodeRepository.secondsSinceLastCode.mockResolvedValue(30);

    await authService.resendVerification({ email: PENDING.email });

    expect(emailVerificationCodeRepository.create).not.toHaveBeenCalled();
    expect(emailService.sendVerificationEmail).not.toHaveBeenCalled();
  });

  it('sends a new code and cancels the older ones', async () => {
    userRepository.findByEmail.mockResolvedValue(PENDING);
    emailVerificationCodeRepository.secondsSinceLastCode.mockResolvedValue(90);

    await authService.resendVerification({ email: PENDING.email });

    expect(emailVerificationCodeRepository.invalidateAllForUser).toHaveBeenCalledWith(
      PENDING.id,
      CLIENT,
    );
    expect(emailService.sendVerificationEmail).toHaveBeenCalledWith({
      user: PENDING,
      code: '123456',
      expiresInMinutes: 10,
    });
  });
});

describe('login with an unverified email', () => {
  const input = { email: PENDING.email, password: 'Test@12345' };

  it('answers 403 EMAIL_NOT_VERIFIED, sends a new code and issues no tokens', async () => {
    userRepository.findByEmailWithPassword.mockResolvedValue({
      ...PENDING,
      passwordHash: 'stored-hash',
    });

    await expect(authService.login(input)).rejects.toMatchObject({
      statusCode: 403,
      code: 'EMAIL_NOT_VERIFIED',
    });
    expect(emailService.sendVerificationEmail).toHaveBeenCalledTimes(1);
    expect(refreshTokenRepository.create).not.toHaveBeenCalled();
  });

  it('says nothing about verification when the password is wrong', async () => {
    userRepository.findByEmailWithPassword.mockResolvedValue({
      ...PENDING,
      passwordHash: 'stored-hash',
    });
    hash.comparePassword.mockResolvedValue(false);

    await expect(authService.login(input)).rejects.toMatchObject({ statusCode: 401 });
    expect(emailService.sendVerificationEmail).not.toHaveBeenCalled();
  });
});

describe('login', () => {
  const input = { email: 'test@example.com', password: 'Test@12345' };

  it('gives the same 401 for an unknown email and still compares against the dummy hash', async () => {
    userRepository.findByEmailWithPassword.mockResolvedValue(null);

    await expect(authService.login(input)).rejects.toMatchObject({
      statusCode: 401,
      message: 'Invalid email or password',
    });
    expect(hash.comparePassword).toHaveBeenCalledWith(input.password, hash.DUMMY_HASH);
    expect(refreshTokenRepository.create).not.toHaveBeenCalled();
  });

  it('rejects a wrong password', async () => {
    userRepository.findByEmailWithPassword.mockResolvedValue({
      ...USER,
      passwordHash: 'stored-hash',
    });
    hash.comparePassword.mockResolvedValue(false);

    await expect(authService.login(input)).rejects.toMatchObject({
      statusCode: 401,
      message: 'Invalid email or password',
    });
    expect(refreshTokenRepository.create).not.toHaveBeenCalled();
  });

  it('returns tokens and never exposes the password hash', async () => {
    userRepository.findByEmailWithPassword.mockResolvedValue({
      ...USER,
      passwordHash: 'stored-hash',
    });

    const result = await authService.login(input);

    expect(hash.comparePassword).toHaveBeenCalledWith(input.password, 'stored-hash');
    expect(result.user).toEqual(USER);
    expect(result.user).not.toHaveProperty('passwordHash');
    expect(result.accessToken).toBe('access-token');
    expect(result.refreshToken).toBe('refresh-token');
  });
});

describe('refresh', () => {
  it('rejects a missing token', async () => {
    await expect(authService.refresh(undefined)).rejects.toMatchObject({
      statusCode: 401,
      message: 'Refresh token missing',
    });
  });

  it('rejects a token with an invalid signature before touching the database', async () => {
    jwt.verifyRefreshToken.mockImplementation(() => {
      throw ApiError.unauthorized('Invalid refresh token');
    });

    await expect(authService.refresh('forged')).rejects.toMatchObject({ statusCode: 401 });
    expect(refreshTokenRepository.claimByHash).not.toHaveBeenCalled();
  });

  it('swaps a valid token for a new pair', async () => {
    refreshTokenRepository.claimByHash.mockResolvedValue(USER.id);
    userRepository.findById.mockResolvedValue(USER);

    const result = await authService.refresh('old-refresh');

    expect(refreshTokenRepository.claimByHash).toHaveBeenCalledWith('hash:old-refresh', CLIENT);
    expect(refreshTokenRepository.create).toHaveBeenCalledWith(
      { userId: USER.id, tokenHash: 'hash:refresh-token', expiresAt: EXPIRES_AT },
      CLIENT,
    );
    expect(result).toEqual({
      user: USER,
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    });
  });

  it('revokes every token of the user when an already used token is presented again', async () => {
    refreshTokenRepository.claimByHash.mockResolvedValue(null);
    refreshTokenRepository.findByHash.mockResolvedValue({ userId: USER.id, revoked: true });

    await expect(authService.refresh('old-refresh')).rejects.toMatchObject({ statusCode: 401 });
    expect(refreshTokenRepository.revokeAllForUser).toHaveBeenCalledWith(USER.id, CLIENT);
  });

  it('does not revoke anything for a token that was never stored', async () => {
    refreshTokenRepository.claimByHash.mockResolvedValue(null);
    refreshTokenRepository.findByHash.mockResolvedValue(null);

    await expect(authService.refresh('unknown')).rejects.toMatchObject({ statusCode: 401 });
    expect(refreshTokenRepository.revokeAllForUser).not.toHaveBeenCalled();
  });
});

describe('logout', () => {
  it('does nothing without a token', async () => {
    await authService.logout(undefined);

    expect(refreshTokenRepository.revokeByHash).not.toHaveBeenCalled();
  });

  it('revokes the token it was given', async () => {
    await authService.logout('raw-refresh');

    expect(refreshTokenRepository.revokeByHash).toHaveBeenCalledWith('hash:raw-refresh');
  });
});

describe('forgotPassword', () => {
  it('does nothing for an unknown email', async () => {
    userRepository.findByEmail.mockResolvedValue(null);

    await authService.forgotPassword({ email: 'nobody@example.com' });

    expect(passwordResetTokenRepository.create).not.toHaveBeenCalled();
    expect(emailService.sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it('stores a hashed token and emails the reset link', async () => {
    userRepository.findByEmail.mockResolvedValue(USER);

    await authService.forgotPassword({ email: USER.email });

    expect(passwordResetTokenRepository.invalidateAllForUser).toHaveBeenCalledWith(USER.id, CLIENT);
    expect(passwordResetTokenRepository.create).toHaveBeenCalledWith(
      { userId: USER.id, tokenHash: 'hash:random-reset-token', expiresAt: expect.any(Date) },
      CLIENT,
    );
    expect(emailService.sendPasswordResetEmail).toHaveBeenCalledWith({
      user: USER,
      resetUrl: expect.stringContaining('/reset-password?token=random-reset-token'),
      expiresInMinutes: 30,
    });
  });
});

describe('resetPassword', () => {
  const input = { token: 'random-reset-token', password: 'NewPass@12345' };

  it('rejects an invalid or expired token', async () => {
    passwordResetTokenRepository.claimByHash.mockResolvedValue(null);

    await expect(authService.resetPassword(input)).rejects.toMatchObject({ statusCode: 400 });
    expect(userRepository.updatePassword).not.toHaveBeenCalled();
  });

  it('sets the new password and logs the user out everywhere', async () => {
    passwordResetTokenRepository.claimByHash.mockResolvedValue(USER.id);

    await authService.resetPassword(input);

    expect(passwordResetTokenRepository.claimByHash).toHaveBeenCalledWith(
      'hash:random-reset-token',
      CLIENT,
    );
    expect(userRepository.updatePassword).toHaveBeenCalledWith(USER.id, 'hashed-password', CLIENT);
    expect(refreshTokenRepository.revokeAllForUser).toHaveBeenCalledWith(USER.id, CLIENT);
    expect(passwordResetTokenRepository.invalidateAllForUser).toHaveBeenCalledWith(USER.id, CLIENT);
    // The link proves the owner reads that mailbox, so the email counts as verified.
    expect(userRepository.markEmailVerified).toHaveBeenCalledWith(USER.id, CLIENT);
    expect(emailVerificationCodeRepository.invalidateAllForUser).toHaveBeenCalledWith(
      USER.id,
      CLIENT,
    );
  });
});
