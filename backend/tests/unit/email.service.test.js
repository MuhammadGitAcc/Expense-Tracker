'use strict';

const CONFIGURED = {
  host: 'smtp.test.local',
  port: 587,
  user: 'smtp-user',
  pass: 'smtp-key',
  from: 'Expense Tracker <no-reply@test.local>',
};

const NOT_CONFIGURED = { host: '', port: undefined, user: undefined, pass: undefined, from: '' };

/** Loads a fresh email service with a fake nodemailer, a fake logger and the given SMTP settings. */
function load(smtp) {
  jest.resetModules();

  const sendMail = jest.fn().mockResolvedValue({});
  const createTransport = jest.fn(() => ({ sendMail }));
  const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
  jest.doMock('nodemailer', () => ({ createTransport }));
  jest.doMock('../../src/config/logger', () => logger);

  const env = require('../../src/config/env');
  Object.assign(env.smtp, smtp);
  const emailService = require('../../src/services/email.service');

  return { emailService, env, sendMail, createTransport, logger };
}

const user = { email: 'ann@test.local', name: 'Ann' };

describe('sendMail', () => {
  it('only logs a preview and returns false when SMTP is not configured', async () => {
    const { emailService, createTransport, logger } = load(NOT_CONFIGURED);

    const sent = await emailService.sendMail({
      to: user.email,
      subject: 'Hello',
      html: '<p>Hi</p>',
      text: 'Hi there',
    });

    expect(sent).toBe(false);
    expect(createTransport).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledTimes(1);
    expect(logger.info.mock.calls[0][0]).toContain(user.email);
    expect(logger.info.mock.calls[0][0]).toContain('Hi there');
  });

  it('treats an example.com host as not configured', async () => {
    const { emailService, createTransport } = load({ ...CONFIGURED, host: 'smtp.example.com' });

    const sent = await emailService.sendMail({
      to: user.email,
      subject: 'Hello',
      html: '<p>Hi</p>',
      text: 'Hi',
    });

    expect(sent).toBe(false);
    expect(createTransport).not.toHaveBeenCalled();
  });

  it('sends through SMTP when configured', async () => {
    const { emailService, sendMail, createTransport } = load(CONFIGURED);

    const sent = await emailService.sendMail({
      to: user.email,
      subject: 'Hello',
      html: '<p>Hi</p>',
      text: 'Hi',
    });

    expect(sent).toBe(true);
    expect(createTransport).toHaveBeenCalledWith({
      host: CONFIGURED.host,
      port: 587,
      secure: false,
      auth: { user: CONFIGURED.user, pass: CONFIGURED.pass },
    });
    expect(sendMail).toHaveBeenCalledWith({
      from: CONFIGURED.from,
      to: user.email,
      subject: 'Hello',
      html: '<p>Hi</p>',
      text: 'Hi',
    });
  });

  it('uses a secure connection on port 465', async () => {
    const { emailService, createTransport } = load({ ...CONFIGURED, port: 465 });

    await emailService.sendMail({ to: user.email, subject: 'S', html: 'h', text: 't' });

    expect(createTransport).toHaveBeenCalledWith(expect.objectContaining({ secure: true }));
  });

  it('sends without a login when no SMTP user is set', async () => {
    const { emailService, createTransport } = load({ ...CONFIGURED, user: '', pass: '' });

    await emailService.sendMail({ to: user.email, subject: 'S', html: 'h', text: 't' });

    expect(createTransport).toHaveBeenCalledWith(expect.objectContaining({ auth: undefined }));
  });

  it('creates the SMTP connection only once', async () => {
    const { emailService, createTransport, sendMail } = load(CONFIGURED);

    await emailService.sendMail({ to: user.email, subject: 'One', html: 'h', text: 't' });
    await emailService.sendMail({ to: user.email, subject: 'Two', html: 'h', text: 't' });

    expect(createTransport).toHaveBeenCalledTimes(1);
    expect(sendMail).toHaveBeenCalledTimes(2);
  });

  it('never throws when the SMTP server fails: logs the error and returns false', async () => {
    const { emailService, sendMail, logger } = load(CONFIGURED);
    sendMail.mockRejectedValue(new Error('connection refused'));

    const sent = await emailService.sendMail({
      to: user.email,
      subject: 'Hello',
      html: 'h',
      text: 't',
    });

    expect(sent).toBe(false);
    expect(logger.error).toHaveBeenCalledWith(
      'Email failed to send',
      expect.objectContaining({ to: user.email, error: 'connection refused' }),
    );
  });
});

describe('email builders', () => {
  it('welcome email greets the user and escapes HTML in the name', async () => {
    const { emailService, env, sendMail } = load(CONFIGURED);

    await emailService.sendWelcomeEmail({ email: user.email, name: '<b>Ann</b>' });

    const [mail] = sendMail.mock.calls[0];
    expect(mail.to).toBe(user.email);
    expect(mail.subject).toBe('Welcome to Expense Tracker');
    expect(mail.html).toContain('&lt;b&gt;Ann&lt;/b&gt;');
    expect(mail.html).not.toContain('<b>Ann</b>');
    expect(mail.text).toContain(env.frontendUrl);
  });

  it('password reset email contains the link and the validity time', async () => {
    const { emailService, sendMail } = load(CONFIGURED);
    const resetUrl = 'https://app.test/reset-password?token=abc123';

    await emailService.sendPasswordResetEmail({ user, resetUrl, expiresInMinutes: 30 });

    const [mail] = sendMail.mock.calls[0];
    expect(mail.subject).toBe('Reset your Expense Tracker password');
    expect(mail.html).toContain(resetUrl);
    expect(mail.text).toContain(resetUrl);
    expect(mail.text).toContain('30 minutes');
  });

  it('verification email puts the code in the subject, the html and the text', async () => {
    const { emailService, sendMail } = load(CONFIGURED);

    await emailService.sendVerificationEmail({ user, code: '042917', expiresInMinutes: 10 });

    const [mail] = sendMail.mock.calls[0];
    expect(mail.subject).toContain('042917');
    expect(mail.html).toContain('042917');
    expect(mail.text).toContain('042917');
    expect(mail.text).toContain('10 minutes');
  });

  it('budget alert email for a warning shows the percentage used', async () => {
    const { emailService, sendMail } = load(CONFIGURED);

    await emailService.sendBudgetAlertEmail({
      user,
      level: 'warning',
      budgetName: 'Food',
      monthLabel: 'November 2026',
      spent: '80.00',
      amount: '100.00',
      percentUsed: 80,
    });

    const [mail] = sendMail.mock.calls[0];
    expect(mail.subject).toBe('Expense Tracker: Budget alert: Food');
    expect(mail.text).toContain(
      'You have used 80% of your Food budget for November 2026 (80.00 of 100.00).',
    );
    expect(mail.html).toContain('Budget alert: Food');
  });

  it('budget alert email for an exceeded budget says the user went over', async () => {
    const { emailService, sendMail } = load(CONFIGURED);

    await emailService.sendBudgetAlertEmail({
      user,
      level: 'exceeded',
      budgetName: 'Food',
      monthLabel: 'November 2026',
      spent: '120.00',
      amount: '100.00',
      percentUsed: 120,
    });

    const [mail] = sendMail.mock.calls[0];
    expect(mail.subject).toBe('Expense Tracker: You went over your Food budget');
    expect(mail.text).toContain(
      'You have spent 120.00 of your 100.00 Food budget for November 2026.',
    );
  });

  it('weekly summary email lists the top categories and the change text', async () => {
    const { emailService, sendMail } = load(CONFIGURED);

    await emailService.sendWeeklySummaryEmail({
      user,
      summary: {
        label: 'Nov 2 - Nov 8, 2026',
        income: '100.00',
        expense: '40.00',
        net: '60.00',
        currency: 'USD',
        topCategories: [
          { name: 'Food', total: '25.00' },
          { name: 'Bills', total: '15.00' },
        ],
        changeText: 'Spending is 10% lower than the week before.',
      },
    });

    const [mail] = sendMail.mock.calls[0];
    expect(mail.subject).toBe('Expense Tracker: your week, Nov 2 - Nov 8, 2026');
    expect(mail.text).toContain('Income: 100.00 USD');
    expect(mail.text).toContain('Expenses: 40.00 USD');
    expect(mail.text).toContain('Net: 60.00 USD');
    expect(mail.text).toContain('Top spending: Food 25.00 USD, Bills 15.00 USD.');
    expect(mail.text).toContain('Spending is 10% lower than the week before.');
    expect(mail.html).toContain('Food 25.00 USD');
  });

  it('weekly summary email leaves out the top categories and change text when empty', async () => {
    const { emailService, sendMail } = load(CONFIGURED);

    await emailService.sendWeeklySummaryEmail({
      user,
      summary: {
        label: 'Nov 2 - Nov 8, 2026',
        income: '0.00',
        expense: '10.00',
        net: '-10.00',
        currency: 'USD',
        topCategories: [],
        changeText: '',
      },
    });

    const [mail] = sendMail.mock.calls[0];
    expect(mail.text).not.toContain('Top spending');
    expect(mail.text).toContain('Net: -10.00 USD');
  });
});
