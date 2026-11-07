'use strict';

/**
 * Validate and clean a request with Zod schemas.
 *
 *   router.post('/', validate({ body: createExpenseSchema }), controller.create);
 *   router.get('/', validate({ query: listQuerySchema }), controller.list);
 *
 * On success the parsed (trimmed, coerced, defaulted) values replace req.body and
 * req.params. In Express 5 `req.query` is read-only, so parsed query values are put on
 * `req.validatedQuery` instead. On failure the ZodError goes to the error middleware (400).
 */
const validate =
  ({ body, query, params } = {}) =>
  (req, _res, next) => {
    try {
      if (params) req.params = params.parse(req.params);
      if (body) req.body = body.parse(req.body ?? {});
      if (query) req.validatedQuery = query.parse(req.query);
      next();
    } catch (err) {
      next(err);
    }
  };

module.exports = validate;
