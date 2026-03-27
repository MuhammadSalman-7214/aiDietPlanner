const express = require('express');
const mealController = require('./meal.controller');
const { validateRequest } = require('../../middlewares/validation.middleware');
const Joi = require('joi');

const router = express.Router();

const generateSchema = Joi.object({
  calories: Joi.number().min(800).max(6000).required(),
  dietType: Joi.string().default('any'),
  allergies: Joi.array().items(Joi.string()).default([]),
  mealsCount: Joi.number().valid(3, 4, 5).default(3),
});

router.post('/generate', validateRequest(generateSchema), mealController.generateMealPlan);

module.exports = router;
