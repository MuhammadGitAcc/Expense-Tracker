'use strict';

const fs = require('fs');
const path = require('path');
const winston = require('winston');
const env = require('./env');

const LOG_DIR = path.join(__dirname, '..', '..', 'logs');
fs.mkdirSync(LOG_DIR, { recursive: true });

const { combine, timestamp, errors, json, colorize, printf } = winston.format;

const consoleFormat = printf(({ level, message, timestamp: ts, stack, ...meta }) => {
  const extra = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
  return `${ts} ${level}: ${stack || message}${extra}`;
});

const transports = [
  new winston.transports.Console({
    format: combine(colorize(), consoleFormat),
    silent: env.isTest,
  }),
  new winston.transports.File({
    filename: path.join(LOG_DIR, 'error.log'),
    level: 'error',
    maxsize: 5 * 1024 * 1024,
    maxFiles: 5,
  }),
  new winston.transports.File({
    filename: path.join(LOG_DIR, 'combined.log'),
    maxsize: 5 * 1024 * 1024,
    maxFiles: 5,
  }),
];

const logger = winston.createLogger({
  level: env.logLevel,
  format: combine(timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), errors({ stack: true }), json()),
  transports,
});

// Lets morgan (HTTP request logging) write into winston.
logger.stream = {
  write: (line) => logger.http(line.trim()),
};

module.exports = logger;
