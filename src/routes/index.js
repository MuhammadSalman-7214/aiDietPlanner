const express = require('express');
const authRoutes = require('../modules/auth/auth.routes');
const userRoutes = require('../modules/user/user.routes');
const dietRoutes = require('../modules/diet/diet.routes');
const mealRoutes = require('../modules/meal/meal.routes');
const nutritionRoutes = require('../modules/nutrition/nutrition.routes');
const chatbotRoutes = require('../modules/chatbot/chatbot.routes');
const reminderRoutes = require('../modules/reminder/reminder.routes');
const consultationRoutes = require('../modules/consultation/consultation.routes');

const router = express.Router();

router.get('/health', (req, res) => {
  res.json({ success: true, status: 'ok', timestamp: new Date().toISOString() });
});

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/diet', dietRoutes);
router.use('/meals', mealRoutes);
router.use('/nutrition', nutritionRoutes);
router.use('/ai', chatbotRoutes);
router.use('/reminders', reminderRoutes);
router.use('/consultations', consultationRoutes);

module.exports = router;
