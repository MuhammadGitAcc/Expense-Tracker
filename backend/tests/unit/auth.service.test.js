'use strict';

jest.mock('../../src/config/db', () => ({ withTransaction: jest.fn() }));
jest.mock('../../src/repositories/user.repository');
jest.mock('../../src/repositories/refreshToken.repository');
jest.mock('../../src/repositories/passwordResetToken.repository');
jest.mock('../../src/services/email.service');
jest.mock('../../src/utils/hash');
jest.mock('../../src/utils/jwt');

const db = require('../../src/config/db');
const ApiError = require('../../src/utils/ApiError');
const userRepository = require('../../src/repositories/user.repository');
const refreshTokenRepository = require('../../src/repositories/refreshToken.repository');
const passwordResetTokenRepository = require('../../src/repositories/passwordResetToken.repository');
const emailService = require('../../src/services/email.service');
const hash = require('../../src/utils/hash');
const jwt = require('../../src/utils/jwt');
const authService = require('../../src/services/auth.service');

const CLIENT = { name: 'transaction-client' };
const USER = { id: 'user-1', name: 'Test User', email: 'test@example.com', role: 'user' };
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
});

describe('register', () => {
  const input = { name: 'Test User', email: 'test@example.com', password: 'Test@12345' };

  it('rejects an email that is already registered', async () => {
    userRepository.emailExists.mockResolvedValue(true);

    await expect(authService.register(input)).rejects.toMatchObject({ statusCode: 409 });
    expect(userRepository.create).not.toHaveBeenCalled();
  });

  it('creates the user, stores a hashed refresh token and sends a welcome email', async () => {
    userRepository.emailExists.mockResolvedValue(false);
    userRepository.create.mockResolvedValue(USER);

    const result = await authService.register(input);

    expect(userRepository.create).toHaveBeenCalledWith(
      { name: input.name, email: input.email, passwordHash: 'hashed-password' },
      CLIENT,
    );
    expect(refreshTokenRepository.create).toHaveBeenCalledWith(
      { userId: USER.id, tokenHash: 'hash:refresh-token', expiresAt: EXPIRES_AT },
      CLIENT,
    );
    expect(emailService.sendWelcomeEmail).toHaveBeenCalledWith(USER);
    expect(result).toEqual({
      user: USER,
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    });
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
  });
});
