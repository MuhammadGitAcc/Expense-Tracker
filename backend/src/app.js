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
const { apiLimiter } = require('./middlewares/rateLimit.middleware');
const notFound = require('./middlewares/notFound.middleware');
const errorMiddleware = require('./middlewares/error.middleware');

const app = express();

app.disable('x-powered-by');
// Behind a reverse proxy (Render, Nginx...) req.ip must come from X-Forwarded-For,
// otherwise every visitor shares one rate-limit bucket.
if (env.isProduction) app.set('trust proxy', 1);

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

app.use(env.apiPrefix, apiLimiter, routes);

// Order matters: 404 after all routes, error handler last.
app.use(notFound);
app.use(errorMiddleware);

module.exports = app;
