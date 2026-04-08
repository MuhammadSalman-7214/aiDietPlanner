const express = require('express');
const Joi = require('joi');
const reminderController = require('./reminder.controller');
const { authMiddleware } = require('../../middlewares/auth.middleware');
const { validateRequest } = require('../../middlewares/validation.middleware');

const router = express.Router();

const reminderSchema = Joi.object({
  type: Joi.string().max(50).default('general'),
  message: Joi.string().max(255).required(),
  scheduledAt: Joi.string().required(),
  enabled: Joi.boolean().default(true),
});

const reminderUpdateSchema = Joi.object({
  type: Joi.string().max(50),
  message: Joi.string().max(255),
  scheduledAt: Joi.string(),
  enabled: Joi.boolean(),
}).min(1);

router.get('/', authMiddleware, reminderController.listReminders);
router.post('/', authMiddleware, validateRequest(reminderSchema), reminderController.createReminder);
router.patch('/:id', authMiddleware, validateRequest(reminderUpdateSchema), reminderController.updateReminder);
router.delete('/:id', authMiddleware, reminderController.deleteReminder);

module.exports = router;
