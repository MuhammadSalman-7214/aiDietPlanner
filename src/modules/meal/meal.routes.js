const express = require('express');
const mealController = require('./meal.controller');
const { authMiddleware } = require('../../middlewares/auth.middleware');
const { validateRequest } = require('../../middlewares/validation.middleware');
const { mealItemReplacementSchema, mealTimeWindowsSchema, mealCompletionSchema } = require('./meal.validation');

const router = express.Router();

router.get('/latest', authMiddleware, mealController.getLatestMealPlan);
router.post('/alternatives', authMiddleware, validateRequest(mealItemReplacementSchema), mealController.getAlternatives);
router.patch('/time-windows', authMiddleware, validateRequest(mealTimeWindowsSchema), mealController.updateMealTimeWindows);
router.post('/complete', authMiddleware, validateRequest(mealCompletionSchema), mealController.completeMeal);

// Meal generation is triggered automatically by /users/stats.
// /meals/alternatives provides item-level replacement suggestions and optional swap previews.

module.exports = router;
