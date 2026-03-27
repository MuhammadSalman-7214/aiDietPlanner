const express = require('express');
const { authMiddleware } = require('../../middlewares/auth.middleware');
const { validateRequest } = require('../../middlewares/validation.middleware');
const userController = require('./user.controller');
const Joi = require('joi');

const router = express.Router();

const updateSchema = Joi.object({
  name: Joi.string().min(2).max(120),
  age: Joi.number().min(10).max(120),
  gender: Joi.string().valid('male', 'female'),
  weight: Joi.number().min(30).max(300),
  height: Joi.number().min(120).max(230),
  activityLevel: Joi.string().valid('sedentary', 'light', 'moderate', 'active', 'very_active'),
  goal: Joi.string().valid('loss', 'gain', 'maintain'),
  password: Joi.string().min(6),
});

router.get('/me', authMiddleware, userController.getProfile);
router.patch('/me', authMiddleware, validateRequest(updateSchema), userController.updateProfile);

module.exports = router;
