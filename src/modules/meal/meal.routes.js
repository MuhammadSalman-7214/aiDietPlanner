const express = require('express');
const mealController = require('./meal.controller');
const { authMiddleware } = require('../../middlewares/auth.middleware');

const router = express.Router();

router.get('/latest', authMiddleware, mealController.getLatestMealPlan);

// Meal generation is now triggered automatically by /users/stats.
// The old POST generator and meal alternatives endpoints are intentionally disabled.

module.exports = router;
