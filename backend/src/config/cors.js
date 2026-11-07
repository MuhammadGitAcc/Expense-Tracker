'use strict';

const env = require('./env');

/**
 * Only the origins listed in CORS_ORIGIN (comma separated) may call the API from a browser.
 * Requests without an Origin header (Postman, curl, server-to-server) are allowed through;
 * they are not subject to browser CORS and are protected by authentication instead.
 * credentials: true is required so the refresh-token cookie is sent (Phase 3).
 */
const corsOptions = {
  origin(origin, callback) {
    if (!origin || env.corsOrigins.includes(origin)) return callback(null, true);
    const err = new Error(`Origin ${origin} is not allowed by CORS`);
    err.status = 403;
    err.isCors = true;
    return callback(err);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 600,
};

module.exports = corsOptions;
