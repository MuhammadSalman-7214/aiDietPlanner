const express = require('express');
const Joi = require('joi');
const nutritionController = require('./nutrition.controller');
const { validateRequest } = require('../../middlewares/validation.middleware');
const { authMiddleware } = require('../../middlewares/auth.middleware');

const router = express.Router();

const logSchema = Joi.object({
  name: Joi.string().required(),
  calories: Joi.number().min(1).required(),
  protein: Joi.number().min(0).default(0),
  carbs: Joi.number().min(0).default(0),
  fats: Joi.number().min(0).default(0),
  targetCalories: Joi.number().min(800).required(),
  date: Joi.string().optional(),
});

router.post('/log', authMiddleware, validateRequest(logSchema), nutritionController.logFood);
router.get('/daily', authMiddleware, nutritionController.getDaily);
router.get('/analysis', authMiddleware, nutritionController.analyze);

module.exports = router;
