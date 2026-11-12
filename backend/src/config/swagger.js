'use strict';

const fs = require('fs');
const path = require('path');
const { Router } = require('express');
const helmet = require('helmet');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yaml');
const env = require('./env');

const SPEC_PATH = path.join(__dirname, '..', '..', 'docs', 'openapi.yaml');

/** Read docs/openapi.yaml once and point its server URL at the configured API prefix. */
function loadSpec() {
  const spec = YAML.parse(fs.readFileSync(SPEC_PATH, 'utf8'));
  spec.servers = [{ url: env.apiPrefix, description: 'This server' }];
  return spec;
}

/**
 * Swagger UI at /api/docs and the raw spec at /api/docs.json.
 * - Off in production unless ENABLE_API_DOCS=true (less to attack, nothing to leak).
 * - Swagger UI needs inline styles, so it gets its own, slightly relaxed Content-Security-Policy.
 *   The strict one from helmet() stays on every other route (app.js mounts this router first).
 */
function createDocsRouter() {
  const spec = loadSpec();
  const router = Router();

  router.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: false,
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:'],
          connectSrc: ["'self'"],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
        },
      },
    }),
  );
  router.get('/docs.json', (_req, res) => res.json(spec));
  router.use(
    '/docs',
    swaggerUi.serve,
    swaggerUi.setup(spec, {
      customSiteTitle: 'Expense Tracker API',
      swaggerOptions: { persistAuthorization: true, displayRequestDuration: true },
    }),
  );
  return router;
}

const docsEnabled = !env.isProduction || env.enableApiDocs;

module.exports = { docsEnabled, createDocsRouter, loadSpec };
