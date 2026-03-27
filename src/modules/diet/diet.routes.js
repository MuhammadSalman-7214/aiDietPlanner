const express = require('express');
const dietController = require('./diet.controller');
const { validateRequest } = require('../../middlewares/validation.middleware');
const Joi = require('joi');

const router = express.Router();

const dietSchema = Joi.object({
  age: Joi.number().min(10).max(120).required(),
  gender: Joi.string().valid('male', 'female').required(),
  weight: Joi.number().min(30).max(300).required(),
  height: Joi.number().min(120).max(230).required(),
  activityLevel: Joi.string().valid('sedentary', 'light', 'moderate', 'active', 'very_active').required(),
  goal: Joi.string().valid('loss', 'gain', 'maintain').required(),
});

router.post('/calculate', validateRequest(dietSchema), dietController.calculateDiet);

module.exports = router;
