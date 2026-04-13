const express = require('express');
const authController = require('./auth.controller');
const { validateRequest } = require('../../middlewares/validation.middleware');
const { authMiddleware } = require('../../middlewares/auth.middleware');
const {
  registerSchema,
  loginSchema,
  verifyOtpSchema,
  resendOtpSchema,
  updatePasswordSchema,
  requestPasswordResetSchema,
  confirmPasswordResetSchema,
} = require('./auth.validation');

const router = express.Router();

router.post('/register', validateRequest(registerSchema), authController.register);
router.post('/login', validateRequest(loginSchema), authController.login);
router.post('/verify-otp', validateRequest(verifyOtpSchema), authController.verifyOtp);
router.post('/resend-otp', validateRequest(resendOtpSchema), authController.resendOtp);
router.post(
  '/password/update',
  authMiddleware,
  validateRequest(updatePasswordSchema),
  authController.updatePassword,
);
router.post(
  '/password/reset/request',
  validateRequest(requestPasswordResetSchema),
  authController.requestPasswordReset,
);
router.post(
  '/password/reset/confirm',
  validateRequest(confirmPasswordResetSchema),
  authController.confirmPasswordReset,
);

module.exports = router;
