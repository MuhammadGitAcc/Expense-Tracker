'use strict';

const emailService = require('../../src/services/email.service');
const db = require('../../src/config/db');
const {
  DEFAULT_USER,
  api,
  url,
  refreshCookie,
  registerUnverified,
  registerUser,
  verifyEmail,
  ageVerificationCodes,
  expireVerificationCodes,
  resetDatabase,
  closeDatabase,
} = require('../helpers');

const credentials = { email: DEFAULT_USER.email, password: DEFAULT_USER.password };
const login = (body = credentials) => api().post(url('/auth/login')).send(body);
const resend = (email = DEFAULT_USER.email) =>
  api().post(url('/auth/resend-verification')).send({ email });
const wrongCodeFor = (code) => (code === '000000' ? '111111' : '000000');
const spyOnVerificationEmail = () =>
  jest.spyOn(emailService, 'sendVerificationEmail').mockResolvedValue(true);

beforeEach(resetDatabase);
afterEach(() => jest.restoreAllMocks());
afterAll(closeDatabase);

describe('register', () => {
  it('emails a 6-digit code and stores only a hash of it', async () => {
    const { code } = await registerUnverified();

    expect(code).toMatch(/^\d{6}$/);
    const { rows } = await db.query('SELECT code_hash FROM email_verification_codes');
    expect(rows).toHaveLength(1);
    expect(rows[0].code_hash).not.toContain(code);
    expect(rows[0].code_hash).toHaveLength(64);
  });

  it('keeps a name with a space', async () => {
    const { user } = await registerUser({ name: 'Test User' });

    expect(user.name).toBe('Test User');
  });

  it('still answers 409 for an email that is verified', async () => {
    await registerUser();

    const res = await api().post(url('/auth/register')).send(DEFAULT_USER);

    expect(res.status).toBe(409);
  });

  it('lets a second registration take over an account that was never verified', async () => {
    const first = await registerUnverified({ name: 'First Name', password: 'First@12345' });
    await ageVerificationCodes(120);
    const second = await registerUnverified({ name: 'Second Name', password: 'Second@12345' });

    const oldCode = await verifyEmail(DEFAULT_USER.email, first.code);
    const newCode = await verifyEmail(DEFAULT_USER.email, second.code);
    const oldPassword = await login({ email: DEFAULT_USER.email, password: 'First@12345' });
    const newPassword = await login({ email: DEFAULT_USER.email, password: 'Second@12345' });

    expect(oldCode.status).toBe(400);
    expect(newCode.status).toBe(200);
    expect(newCode.body.data.user.name).toBe('Second Name');
    expect(oldPassword.status).toBe(401);
    expect(newPassword.status).toBe(200);
  });
});

describe('POST /auth/verify-email', () => {
  it('logs the user in and sends the welcome email', async () => {
    const welcome = jest.spyOn(emailService, 'sendWelcomeEmail').mockResolvedValue(true);
    const { code } = await registerUnverified();

    const res = await verifyEmail(DEFAULT_USER.email, code);

    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toEqual(expect.any(String));
    expect(refreshCookie(res)).toBeTruthy();
    expect(welcome).toHaveBeenCalledTimes(1);
    expect(welcome.mock.calls[0][0].email).toBe(DEFAULT_USER.email);
  });

  it('works only once', async () => {
    const { code } = await registerUnverified();

    const first = await verifyEmail(DEFAULT_USER.email, code);
    const again = await verifyEmail(DEFAULT_USER.email, code);

    expect(first.status).toBe(200);
    expect(again.status).toBe(400);
    expect(again.body.message).toBe('This code is invalid or has expired');
  });

  it('counts wrong codes, and the right code still works afterwards', async () => {
    const { code } = await registerUnverified();

    const wrong = await verifyEmail(DEFAULT_USER.email, wrongCodeFor(code));
    const right = await verifyEmail(DEFAULT_USER.email, code);

    expect(wrong.status).toBe(400);
    expect(wrong.body.message).toMatch(/Incorrect code\. 4 attempt/);
    expect(right.status).toBe(200);
  });

  it('cancels the code after 5 wrong attempts, even for the right code', async () => {
    const { code } = await registerUnverified();
    const bad = wrongCodeFor(code);

    const answers = [];
    for (let i = 0; i < 5; i += 1) {
      answers.push(await verifyEmail(DEFAULT_USER.email, bad));
    }
    const right = await verifyEmail(DEFAULT_USER.email, code);

    answers.forEach((res) => expect(res.status).toBe(400));
    expect(answers[4].body.message).toMatch(/Too many wrong attempts/);
    expect(right.status).toBe(400);
  });

  it('rejects an expired code', async () => {
    const { code } = await registerUnverified();
    await expireVerificationCodes();

    const res = await verifyEmail(DEFAULT_USER.email, code);

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('This code is invalid or has expired');
  });

  it('gives the same answer for an email that does not exist', async () => {
    const res = await verifyEmail('nobody@example.com', '123456');

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('This code is invalid or has expired');
    expect(res.body.data).toBeNull();
  });

  it('does not accept the code of another account', async () => {
    const a = await registerUnverified();
    await registerUnverified({ email: 'other@example.com' });

    const res = await verifyEmail('other@example.com', a.code);

    expect(res.status).toBe(400);
  });

  it('rejects a code that is not 6 digits', async () => {
    await registerUnverified();

    const res = await verifyEmail(DEFAULT_USER.email, '12345');

    expect(res.status).toBe(400);
    expect(res.body.errors[0].field).toBe('code');
  });
});

describe('login gate', () => {
  it('answers 403 EMAIL_NOT_VERIFIED with no token and no cookie', async () => {
    await registerUnverified();

    const res = await login();

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('EMAIL_NOT_VERIFIED');
    expect(res.body.data).toBeNull();
    expect(refreshCookie(res)).toBeNull();
  });

  it('answers 401 for a wrong password, without mentioning verification', async () => {
    await registerUnverified();

    const res = await login({ email: DEFAULT_USER.email, password: 'Wrong@12345' });

    expect(res.status).toBe(401);
    expect(res.body).not.toHaveProperty('code');
  });

  it('sends a new code once the cooldown has passed, and cancels the old one', async () => {
    const first = await registerUnverified();
    await ageVerificationCodes(120);
    const spy = spyOnVerificationEmail();

    const res = await login();
    const newCode = spy.mock.calls[0][0].code;
    const oldAttempt = await verifyEmail(DEFAULT_USER.email, first.code);
    const newAttempt = await verifyEmail(DEFAULT_USER.email, newCode);

    expect(res.status).toBe(403);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(oldAttempt.status).toBe(400);
    expect(newAttempt.status).toBe(200);
  });

  it('does not send a second code inside the cooldown', async () => {
    await registerUnverified();
    const spy = spyOnVerificationEmail();

    const res = await login();

    expect(res.status).toBe(403);
    expect(spy).not.toHaveBeenCalled();
  });

  it('lets a verified user log in', async () => {
    await registerUser();

    const res = await login();

    expect(res.status).toBe(200);
    expect(res.body.data.user.emailVerified).toBe(true);
  });
});

describe('POST /auth/resend-verification', () => {
  it('answers identically for unverified, verified and unknown emails', async () => {
    await registerUser();
    await registerUnverified({ email: 'pending@example.com' });

    const verified = await resend(DEFAULT_USER.email);
    const pending = await resend('pending@example.com');
    const unknown = await resend('nobody@example.com');

    expect(verified.status).toBe(200);
    expect(pending.status).toBe(200);
    expect(unknown.status).toBe(200);
    expect(verified.body).toEqual(pending.body);
    expect(verified.body).toEqual(unknown.body);
  });

  it('sends nothing for a verified or unknown email', async () => {
    await registerUser();
    await ageVerificationCodes(120);
    const spy = spyOnVerificationEmail();

    await resend(DEFAULT_USER.email);
    await resend('nobody@example.com');

    expect(spy).not.toHaveBeenCalled();
  });

  it('allows one new code per 60 seconds, and the new code replaces the old one', async () => {
    const first = await registerUnverified();
    const spy = spyOnVerificationEmail();

    await resend();
    expect(spy).not.toHaveBeenCalled();

    await ageVerificationCodes(120);
    await resend();
    expect(spy).toHaveBeenCalledTimes(1);
    const newCode = spy.mock.calls[0][0].code;

    const oldAttempt = await verifyEmail(DEFAULT_USER.email, first.code);
    const newAttempt = await verifyEmail(DEFAULT_USER.email, newCode);
    expect(oldAttempt.status).toBe(400);
    expect(newAttempt.status).toBe(200);
  });
});

describe('password reset', () => {
  it('also marks the email as verified, because the link proves the mailbox is theirs', async () => {
    const spy = jest.spyOn(emailService, 'sendPasswordResetEmail').mockResolvedValue(true);
    await registerUnverified();
    await api().post(url('/auth/forgot-password')).send({ email: DEFAULT_USER.email });
    const token = new URL(spy.mock.calls[0][0].resetUrl).searchParams.get('token');

    const reset = await api()
      .post(url('/auth/reset-password'))
      .send({ token, password: 'NewPass@12345' });
    const res = await login({ email: DEFAULT_USER.email, password: 'NewPass@12345' });

    expect(reset.status).toBe(200);
    expect(res.status).toBe(200);
    expect(res.body.data.user.emailVerified).toBe(true);
  });
});
