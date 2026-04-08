const express = require('express');
const authController = require('./auth.controller');
const { validateRequest } = require('../../middlewares/validation.middleware');
const { registerSchema, loginSchema, verifyOtpSchema, resendOtpSchema } = require('./auth.validation');

const router = express.Router();

router.post('/register', validateRequest(registerSchema), authController.register);
router.post('/login', validateRequest(loginSchema), authController.login);
router.post('/verify-otp', validateRequest(verifyOtpSchema), authController.verifyOtp);
router.post('/resend-otp', validateRequest(resendOtpSchema), authController.resendOtp);

module.exports = router;
