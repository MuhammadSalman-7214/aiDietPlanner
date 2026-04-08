const express = require('express');
const Joi = require('joi');
const consultationController = require('./consultation.controller');
const { authMiddleware, requirePremium } = require('../../middlewares/auth.middleware');
const { validateRequest } = require('../../middlewares/validation.middleware');

const router = express.Router();

const requestSchema = Joi.object({
  topic: Joi.string().min(3).max(255).required(),
  notes: Joi.string().max(2000).optional(),
  scheduledAt: Joi.string().optional(),
});

router.post(
  '/request',
  authMiddleware,
  requirePremium,
  validateRequest(requestSchema),
  consultationController.requestConsultation
);
router.get('/mine', authMiddleware, requirePremium, consultationController.listMyConsultations);

module.exports = router;
