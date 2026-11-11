'use strict';

const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');
const env = require('../config/env');
const logger = require('../config/logger');

const TEMPLATE_DIR = path.join(__dirname, '..', 'templates', 'emails');
const APP_NAME = 'Expense Tracker';

/** SMTP counts as configured when host, port and sender are set and are not the example placeholders. */
const isConfigured = () => {
  const { host, port, from } = env.smtp;
  return Boolean(host && port && from) && !host.endsWith('example.com');
};

let transporter;
function getTransporter() {
  if (!transporter) {
    const { host, port, user, pass } = env.smtp;
    transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: user ? { user, pass } : undefined,
    });
  }
  return transporter;
}

const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);

/** Fill {{placeholders}} in templates/emails/<name>.html. Every value is HTML-escaped. */
function renderTemplate(name, variables) {
  const html = fs.readFileSync(path.join(TEMPLATE_DIR, `${name}.html`), 'utf8');
  return html.replace(/{{\s*(\w+)\s*}}/g, (_match, key) => escapeHtml(variables[key] ?? ''));
}

/**
 * Send one email. NEVER throws: a mail problem must not break registration or make
 * "forgot password" reveal anything. Resolves true when the email was handed to the
 * SMTP server, false otherwise.
 */
async function sendMail({ to, subject, html, text }) {
  if (!isConfigured()) {
    if (env.isProduction) {
      logger.error('Email not sent: SMTP is not configured', { to, subject });
      return false;
    }
    logger.info(
      `Email not sent (SMTP not configured), development preview\nTo: ${to}\nSubject: ${subject}\n\n${text}`,
    );
    return false;
  }

  try {
    await getTransporter().sendMail({ from: env.smtp.from, to, subject, html, text });
    return true;
  } catch (err) {
    logger.error('Email failed to send', { to, subject, error: err.message });
    return false;
  }
}

function sendWelcomeEmail(user) {
  return sendMail({
    to: user.email,
    subject: `Welcome to ${APP_NAME}`,
    html: renderTemplate('welcome', {
      appName: APP_NAME,
      name: user.name,
      appUrl: env.frontendUrl,
    }),
    text: `Hi ${user.name},\n\nWelcome to ${APP_NAME}. Your account is ready: ${env.frontendUrl}\n`,
  });
}

function sendPasswordResetEmail({ user, resetUrl, expiresInMinutes }) {
  return sendMail({
    to: user.email,
    subject: `Reset your ${APP_NAME} password`,
    html: renderTemplate('resetPassword', {
      appName: APP_NAME,
      name: user.name,
      resetUrl,
      expiresInMinutes,
    }),
    text:
      `Hi ${user.name},\n\n` +
      `Use this link to choose a new password (valid for ${expiresInMinutes} minutes):\n` +
      `${resetUrl}\n\n` +
      'If you did not ask for this, you can ignore this email.\n',
  });
}

function sendVerificationEmail({ user, code, expiresInMinutes }) {
  return sendMail({
    to: user.email,
    subject: `Your ${APP_NAME} verification code: ${code}`,
    html: renderTemplate('verifyEmail', {
      appName: APP_NAME,
      name: user.name,
      code,
      expiresInMinutes,
    }),
    text:
      `Hi ${user.name},\n\n` +
      `Your ${APP_NAME} verification code is: ${code}\n\n` +
      `It is valid for ${expiresInMinutes} minutes and can be used once.\n` +
      'If you did not create an account, you can ignore this email.\n',
  });
}

function sendBudgetAlertEmail({ user, level, budgetName, monthLabel, spent, amount, percentUsed }) {
  const exceeded = level === 'exceeded';
  const heading = exceeded
    ? `You went over your ${budgetName} budget`
    : `Budget alert: ${budgetName}`;
  const summary = exceeded
    ? `You have spent ${spent} of your ${amount} ${budgetName} budget for ${monthLabel}.`
    : `You have used ${percentUsed}% of your ${budgetName} budget for ${monthLabel} (${spent} of ${amount}).`;
  return sendMail({
    to: user.email,
    subject: `${APP_NAME}: ${heading}`,
    html: renderTemplate('budgetAlert', {
      appName: APP_NAME,
      name: user.name,
      heading,
      summary,
      appUrl: env.frontendUrl,
    }),
    text: `Hi ${user.name},\n\n${summary}\n\nOpen ${APP_NAME}: ${env.frontendUrl}\n`,
  });
}

function sendWeeklySummaryEmail({ user, summary }) {
  const top = summary.topCategories.length
    ? `Top spending: ${summary.topCategories
        .map((c) => `${c.name} ${c.total} ${summary.currency}`)
        .join(', ')}.`
    : '';
  return sendMail({
    to: user.email,
    subject: `${APP_NAME}: your week, ${summary.label}`,
    html: renderTemplate('weeklySummary', {
      appName: APP_NAME,
      name: user.name,
      weekLabel: summary.label,
      income: summary.income,
      expense: summary.expense,
      net: summary.net,
      currency: summary.currency,
      topCategories: top,
      changeText: summary.changeText,
      appUrl: env.frontendUrl,
    }),
    text:
      `Hi ${user.name},\n\nYour week, ${summary.label}:\n` +
      `Income: ${summary.income} ${summary.currency}\n` +
      `Expenses: ${summary.expense} ${summary.currency}\n` +
      `Net: ${summary.net} ${summary.currency}\n` +
      `${top ? `${top}\n` : ''}${summary.changeText ? `${summary.changeText}\n` : ''}` +
      `\nOpen ${APP_NAME}: ${env.frontendUrl}\n`,
  });
}

module.exports = {
  sendMail,
  sendWelcomeEmail,
  sendPasswordResetEmail,
  sendVerificationEmail,
  sendBudgetAlertEmail,
  sendWeeklySummaryEmail,
};
