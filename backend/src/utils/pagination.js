'use strict';

const { PAGINATION } = require('./constants');

/**
 * Turn ?page=2&limit=20 into safe numbers for SQL LIMIT / OFFSET.
 * Bad or missing values fall back to defaults; limit is capped at maxLimit.
 */
function getPagination(
  query = {},
  { defaultLimit = PAGINATION.DEFAULT_LIMIT, maxLimit = PAGINATION.MAX_LIMIT } = {},
) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(maxLimit, Math.max(1, parseInt(query.limit, 10) || defaultLimit));
  return { page, limit, offset: (page - 1) * limit };
}

/** The `meta` block returned with a list response. */
function buildMeta({ total, page, limit }) {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  return {
    total,
    page,
    limit,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };
}

module.exports = { getPagination, buildMeta };
