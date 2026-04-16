const express = require("express");
const { authMiddleware } = require("../../middlewares/auth.middleware");
const { validateRequest } = require("../../middlewares/validation.middleware");
const {
  handleProfileImageUpload,
  attachProfileImageUrl,
} = require("../../middlewares/upload.middleware");
const userController = require("./user.controller");
const Joi = require("joi");

const router = express.Router();

const updateSchema = Joi.object({
  name: Joi.string().min(2).max(120),
  profileImageUrl: Joi.string().max(2048).allow(null),
}).min(1);

const nutritionSchema = Joi.object({
  age: Joi.number().min(10).max(120).allow(null),
  gender: Joi.string().valid("male", "female").allow(null),
  activityLevel: Joi.string()
    .valid("sedentary", "light", "moderate", "active", "very_active")
    .allow(null),
  goal: Joi.string().valid("loss", "gain", "maintain").allow(null),
  heightCm: Joi.number().min(50).max(300).allow(null),
  weightKg: Joi.number().min(10).max(500).allow(null),
  mealPreferences: Joi.alternatives().try(
    Joi.array().items(Joi.string().min(1)).max(50),
    Joi.string().min(1),
  ),
  mealAllergies: Joi.alternatives().try(
    Joi.array().items(Joi.string().min(1)).max(50),
    Joi.string().min(1),
  ),
  mealDislikes: Joi.alternatives().try(
    Joi.array().items(Joi.string().min(1)).max(50),
    Joi.string().min(1),
  ),
}).min(1);

const statusSchema = Joi.object({
  isActive: Joi.boolean().required(),
});

router.get("/me", authMiddleware, userController.getProfile);
router.put(
  "/me",
  authMiddleware,
  handleProfileImageUpload,
  attachProfileImageUrl,
  validateRequest(updateSchema),
  userController.updateProfile,
);
// router.patch(
//   "/status",
//   authMiddleware,
//   validateRequest(statusSchema),
//   userController.updateUserStatus,
// );
// Profile endpoints are intentionally disabled.
// Nutritional data is managed exclusively through /users/stats,
// which now also triggers automatic meal-plan generation.
// router.get("/profile", authMiddleware, userController.getHealthProfile);
// router.post(
//   "/profile",
//   authMiddleware,
//   validateRequest(nutritionSchema),
//   userController.createHealthProfile,
// );
// router.patch(
//   "/profile",
//   authMiddleware,
//   validateRequest(nutritionSchema),
//   userController.updateHealthProfile,
// );
router.get("/stats", authMiddleware, userController.getStats);
router.post(
  "/stats",
  authMiddleware,
  validateRequest(nutritionSchema),
  userController.createStats,
);
router.patch(
  "/stats",
  authMiddleware,
  validateRequest(nutritionSchema),
  userController.updateStats,
);
router.get("/data/export", authMiddleware, userController.exportUserData);
router.delete("/status", authMiddleware, userController.deactivateUserAccount);
router.delete("/account", authMiddleware, userController.deleteUserAccount);
router.get("/weight-history", authMiddleware, userController.getWeightHistory);

module.exports = router;
