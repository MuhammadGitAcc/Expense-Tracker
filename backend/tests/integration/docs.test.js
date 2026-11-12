'use strict';

const fs = require('fs');
const path = require('path');
const request = require('supertest');
const app = require('../../src/app');
const { loadSpec } = require('../../src/config/swagger');

const ROUTES_DIR = path.join(__dirname, '..', '..', 'src', 'routes');
const METHODS = ['get', 'post', 'put', 'patch', 'delete'];

/** Every "router.<method>('<path>'" in the route files, joined with its mount path. */
function routesInCode() {
  const index = fs.readFileSync(path.join(ROUTES_DIR, 'index.js'), 'utf8');
  const found = new Set();

  // Routes declared directly in routes/index.js (for example /health).
  for (const m of index.matchAll(/router\.(get|post|put|patch|delete)\(\s*'([^']+)'/g)) {
    found.add(`${m[1]} ${m[2]}`);
  }
  // Routers mounted with router.use('/prefix', require('./x.routes')).
  for (const mount of index.matchAll(/router\.use\('([^']+)',\s*require\('\.\/([^']+)'\)\)/g)) {
    const [, prefix, file] = mount;
    const source = fs.readFileSync(path.join(ROUTES_DIR, `${file}.js`), 'utf8');
    for (const m of source.matchAll(/router\.(get|post|put|patch|delete)\(\s*'([^']+)'/g)) {
      const sub = m[2] === '/' ? '' : m[2];
      found.add(`${m[1]} ${prefix}${sub}`);
    }
  }
  return found;
}

/** "get /expenses/{id}" for every operation in the OpenAPI file, with {id} written as :id. */
function routesInSpec(spec) {
  const found = new Set();
  for (const [route, item] of Object.entries(spec.paths)) {
    for (const method of METHODS) {
      if (item[method]) found.add(`${method} ${route.replace(/\{(\w+)\}/g, ':$1')}`);
    }
  }
  return found;
}

describe('API documentation', () => {
  const spec = loadSpec();

  test('documents every route in the code and nothing else', () => {
    const code = routesInCode();
    const documented = routesInSpec(spec);
    expect(code.size).toBeGreaterThan(50); // the parser really found the routes
    expect([...code].filter((r) => !documented.has(r))).toEqual([]);
    expect([...documented].filter((r) => !code.has(r))).toEqual([]);
  });

  test('every $ref points to something that exists', () => {
    const text = JSON.stringify(spec);
    const missing = [];
    for (const [, ref] of text.matchAll(/"\$ref":"#\/([^"]+)"/g)) {
      const target = ref.split('/').reduce((node, key) => node?.[key], spec);
      if (!target) missing.push(ref);
    }
    expect(missing).toEqual([]);
  });

  test('every protected operation is documented with a 401, and every operation has a summary', () => {
    const problems = [];
    for (const [route, item] of Object.entries(spec.paths)) {
      for (const method of METHODS) {
        const op = item[method];
        if (!op) continue;
        if (!op.summary) problems.push(`${method} ${route}: no summary`);
        const isPublic = Array.isArray(op.security) && op.security.length === 0;
        if (!isPublic && !op.responses['401']) problems.push(`${method} ${route}: no 401`);
      }
    }
    expect(problems).toEqual([]);
  });

  test('GET /api/docs.json serves the spec', async () => {
    const res = await request(app).get('/api/docs.json');
    expect(res.status).toBe(200);
    expect(res.body.openapi).toMatch(/^3\./);
    expect(Object.keys(res.body.paths).length).toBeGreaterThan(40);
  });

  test('GET /api/docs serves Swagger UI with a Content-Security-Policy that allows it', async () => {
    const res = await request(app).get('/api/docs/');
    expect(res.status).toBe(200);
    expect(res.text).toContain('swagger-ui');
    expect(res.headers['content-security-policy']).toContain("style-src 'self' 'unsafe-inline'");
  });

  test('the API itself keeps the strict Content-Security-Policy', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.headers['content-security-policy']).toContain("script-src 'self';");
  });
});
