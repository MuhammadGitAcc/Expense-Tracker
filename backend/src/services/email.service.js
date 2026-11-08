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

module.exports = { sendMail, sendWelcomeEmail, sendPasswordResetEmail, sendVerificationEmail };
