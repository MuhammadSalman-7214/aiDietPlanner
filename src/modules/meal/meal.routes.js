const express = require('express');
const mealController = require('./meal.controller');
const { validateRequest } = require('../../middlewares/validation.middleware');
const { authMiddleware } = require('../../middlewares/auth.middleware');
const Joi = require('joi');

const router = express.Router();

const generateSchema = Joi.object({
  mealsCount: Joi.number().valid(3, 4, 5).default(3),
});

const alternativesSchema = Joi.object({
  mealType: Joi.string().valid('breakfast', 'lunch', 'dinner', 'snack').required(),
});

router.post('/generate', authMiddleware, validateRequest(generateSchema), mealController.generateMealPlan);
router.post('/alternatives', authMiddleware, validateRequest(alternativesSchema), mealController.getAlternatives);

module.exports = router;
