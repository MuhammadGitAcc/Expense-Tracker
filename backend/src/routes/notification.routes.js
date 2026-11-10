'use strict';

const { Router } = require('express');
const validate = require('../middlewares/validate.middleware');
const { authenticate } = require('../middlewares/auth.middleware');
const notificationController = require('../controllers/notification.controller');
const {
  idParamSchema,
  listNotificationsQuerySchema,
} = require('../validators/notification.validator');

const router = Router();

router.use(authenticate);

router.get('/', validate({ query: listNotificationsQuerySchema }), notificationController.list);
router.get('/unread-count', notificationController.unreadCount);
// "read-all" is declared before "/:id/read" so the two can never be confused.
router.put('/read-all', notificationController.markAllRead);
router.put('/:id/read', validate({ params: idParamSchema }), notificationController.markRead);

module.exports = router;
