'use strict';

/**
 * Every response has the same shape:  { success, message, data, meta }
 * Errors use the same shape (success: false, data: null) from the error middleware.
 */
const body = (success, message, data, meta) => ({
  success,
  message,
  data: data ?? null,
  meta: meta ?? null,
});

const ApiResponse = {
  body,

  success(res, { data = null, message = 'Success', meta = null, status = 200 } = {}) {
    return res.status(status).json(body(true, message, data, meta));
  },

  created(res, { data = null, message = 'Created', meta = null } = {}) {
    return res.status(201).json(body(true, message, data, meta));
  },

  /** For DELETE and other actions with nothing to return. */
  noContent(res) {
    return res.status(204).send();
  },

  /** items + pagination meta, see utils/pagination.js */
  paginated(res, { data, meta, message = 'Success' }) {
    return res.status(200).json(body(true, message, data, meta));
  },
};

module.exports = ApiResponse;
