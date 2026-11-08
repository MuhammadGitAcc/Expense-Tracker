'use strict';

const { Router } = require('express');
const validate = require('../middlewares/validate.middleware');
const { authenticate } = require('../middlewares/auth.middleware');
const { authLimiter } = require('../middlewares/rateLimit.middleware');
const { uploadAvatar } = require('../middlewares/upload.middleware');
const userController = require('../controllers/user.controller');
const {
  updateProfileSchema,
  changePasswordSchema,
  deleteAccountSchema,
} = require('../validators/user.validator');

const router = Router();

router.use(authenticate);

router.get('/me', userController.getMe);
router.put('/me', validate({ body: updateProfileSchema }), userController.updateMe);
router.put(
  '/me/password',
  authLimiter,
  validate({ body: changePasswordSchema }),
  userController.changePassword,
);
router.post('/me/avatar', uploadAvatar, userController.uploadAvatar);
router.delete('/me', authLimiter, validate({ body: deleteAccountSchema }), userController.deleteMe);

module.exports = router;
