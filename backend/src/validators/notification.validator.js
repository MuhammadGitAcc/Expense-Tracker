'use strict';

const { z } = require('zod');
const { NOTIFICATION_TYPES } = require('../utils/constants');

const idParamSchema = z.object({ id: z.uuid('Invalid notification id') });

// ?page=1&limit=20&isRead=false&type=budget_exceeded
// (z.coerce.boolean would turn the text "false" into true, so the text is compared.)
const listNotificationsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  isRead: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  type: z.enum(NOTIFICATION_TYPES).optional(),
});

module.exports = { idParamSchema, listNotificationsQuerySchema };
