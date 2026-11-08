'use strict';

const { Router } = require('express');
const validate = require('../middlewares/validate.middleware');
const { authLimiter } = require('../middlewares/rateLimit.middleware');
const authController = require('../controllers/auth.controller');
const {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  verifyEmailSchema,
  resendVerificationSchema,
} = require('../validators/auth.validator');

const router = Router();

router.post('/register', authLimiter, validate({ body: registerSchema }), authController.register);
router.post(
  '/verify-email',
  authLimiter,
  validate({ body: verifyEmailSchema }),
  authController.verifyEmail,
);
router.post(
  '/resend-verification',
  authLimiter,
  validate({ body: resendVerificationSchema }),
  authController.resendVerification,
);
router.post('/login', authLimiter, validate({ body: loginSchema }), authController.login);
router.post('/refresh', authController.refresh);
router.post('/logout', authController.logout);
router.post(
  '/forgot-password',
  authLimiter,
  validate({ body: forgotPasswordSchema }),
  authController.forgotPassword,
);
router.post(
  '/reset-password',
  authLimiter,
  validate({ body: resetPasswordSchema }),
  authController.resetPassword,
);

module.exports = router;
