const express = require('express');
const mealController = require('./meal.controller');
const { validateRequest } = require('../../middlewares/validation.middleware');
const { authMiddleware } = require('../../middlewares/auth.middleware');
const Joi = require('joi');

const router = express.Router();

const generateSchema = Joi.object({
  calories: Joi.number().min(800).max(6000),
  targetCalories: Joi.number().min(800).max(6000),
  dietType: Joi.string().default('any'),
  allergies: Joi.array().items(Joi.string()).default([]),
  mealDislikes: Joi.array().items(Joi.string()).default([]),
  mealsCount: Joi.number().valid(3, 4, 5).default(3),
});

const alternativesSchema = Joi.object({
  calories: Joi.number().min(800).max(6000),
  targetCalories: Joi.number().min(800).max(6000),
  dietType: Joi.string().default('any'),
  allergies: Joi.array().items(Joi.string()).default([]),
  mealDislikes: Joi.array().items(Joi.string()).default([]),
  mealType: Joi.string().valid('breakfast', 'lunch', 'dinner', 'snack').required(),
});

router.post('/generate', authMiddleware, validateRequest(generateSchema), mealController.generateMealPlan);
router.post('/alternatives', authMiddleware, validateRequest(alternativesSchema), mealController.getAlternatives);

module.exports = router;
