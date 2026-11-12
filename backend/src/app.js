'use strict';

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');

const env = require('./config/env');
const logger = require('./config/logger');
const corsOptions = require('./config/cors');
const routes = require('./routes');
const { docsEnabled, createDocsRouter } = require('./config/swagger');
const { AVATAR_DIR } = require('./services/upload.service');
const { apiLimiter } = require('./middlewares/rateLimit.middleware');
const notFound = require('./middlewares/notFound.middleware');
const errorMiddleware = require('./middlewares/error.middleware');

const app = express();

app.disable('x-powered-by');
// Behind a reverse proxy (Render, Nginx...) req.ip must come from X-Forwarded-For,
// otherwise every visitor shares one rate-limit bucket.
if (env.isProduction) app.set('trust proxy', 1);

// API docs first: they bring their own Content-Security-Policy, which the strict helmet()
// below must not overwrite. Path: /api/docs (not under the versioned API prefix).
if (docsEnabled) app.use('/api', createDocsRouter());

app.use(helmet());
app.use(cors(corsOptions));
app.use(compression());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));
app.use(cookieParser());

if (!env.isTest) {
  app.use(
    morgan(':method :url :status :res[content-length] - :response-time ms', {
      stream: logger.stream,
    }),
  );
}

// Only avatars are public. Receipts are private and are sent by the API after an
// ownership check (GET /expenses/:id/receipt), never as static files.
app.use(
  '/uploads/avatars',
  (_req, res, next) => {
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    next();
  },
  express.static(AVATAR_DIR, { index: false, dotfiles: 'deny', maxAge: '7d' }),
);

// API answers hold tokens and money data: browsers and proxies must not keep them.
const noStore = (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
};

app.use(env.apiPrefix, noStore, apiLimiter, routes);

// Order matters: 404 after all routes, error handler last.
app.use(notFound);
app.use(errorMiddleware);

module.exports = app;
