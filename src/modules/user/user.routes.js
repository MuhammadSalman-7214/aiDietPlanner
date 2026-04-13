const express = require('express');
const { authMiddleware } = require('../../middlewares/auth.middleware');
const { validateRequest } = require('../../middlewares/validation.middleware');
const userController = require('./user.controller');
const Joi = require('joi');

const router = express.Router();

const updateSchema = Joi.object({
  name: Joi.string().min(2).max(120),
});

const profileSchema = Joi.object({
  age: Joi.number().min(10).max(120).allow(null),
  gender: Joi.string().valid('male', 'female').allow(null),
  activityLevel: Joi.string()
    .valid('sedentary', 'light', 'moderate', 'active', 'very_active')
    .allow(null),
  goal: Joi.string().valid('loss', 'gain', 'maintain').allow(null),
}).min(1);

const statsSchema = Joi.object({
  heightCm: Joi.number().min(50).max(300).allow(null),
  weightKg: Joi.number().min(10).max(500).allow(null),
  mealPreferences: Joi.alternatives().try(
    Joi.array().items(Joi.string().min(1)).max(50),
    Joi.string().min(1)
  ),
  mealAllergies: Joi.alternatives().try(
    Joi.array().items(Joi.string().min(1)).max(50),
    Joi.string().min(1)
  ),
}).min(1);

const healthSchema = Joi.object({
  age: Joi.number().min(10).max(120).allow(null),
  gender: Joi.string().valid('male', 'female').allow(null),
  activityLevel: Joi.string()
    .valid('sedentary', 'light', 'moderate', 'active', 'very_active')
    .allow(null),
  goal: Joi.string().valid('loss', 'gain', 'maintain').allow(null),
  heightCm: Joi.number().min(50).max(300).allow(null),
  weightKg: Joi.number().min(10).max(500).allow(null),
  mealPreferences: Joi.alternatives().try(
    Joi.array().items(Joi.string().min(1)).max(50),
    Joi.string().min(1)
  ),
  mealAllergies: Joi.alternatives().try(
    Joi.array().items(Joi.string().min(1)).max(50),
    Joi.string().min(1)
  ),
}).min(1);

const statusSchema = Joi.object({
  isActive: Joi.boolean().required(),
});

router.get('/me', authMiddleware, userController.getProfile);
router.patch('/me', authMiddleware, validateRequest(updateSchema), userController.updateProfile);
router.patch('/status', authMiddleware, validateRequest(statusSchema), userController.updateUserStatus);
router.get('/health', authMiddleware, userController.getHealthData);
router.post('/health', authMiddleware, validateRequest(healthSchema), userController.createHealthData);
router.patch('/health', authMiddleware, validateRequest(healthSchema), userController.updateHealthData);
router.get('/profile', authMiddleware, userController.getHealthProfile);
router.post('/profile', authMiddleware, validateRequest(profileSchema), userController.createHealthProfile);
router.patch('/profile', authMiddleware, validateRequest(profileSchema), userController.updateHealthProfile);
router.get('/stats', authMiddleware, userController.getStats);
router.post('/stats', authMiddleware, validateRequest(statsSchema), userController.createStats);
router.patch('/stats', authMiddleware, validateRequest(statsSchema), userController.updateStats);
router.get('/data/export', authMiddleware, userController.exportUserData);
router.delete('/data', authMiddleware, userController.deleteUserAccount);
router.get('/weight-history', authMiddleware, userController.getWeightHistory);

module.exports = router;
