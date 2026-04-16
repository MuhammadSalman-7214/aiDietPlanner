const fs = require('fs/promises');
const path = require('path');
const logger = require('../../utils/logger');
const { AppError } = require('../../middlewares/error.middleware');
const userRepo = require('./user.repository');
const mealService = require('../meal/meal.service');

const uploadsRoot = path.join(__dirname, '..', '..', '..', 'uploads');
const profileImagesPrefix = '/uploads/profile-images/';

const deleteProfileImageFile = async (profileImageUrl) => {
  if (!profileImageUrl || typeof profileImageUrl !== 'string') return;
  if (!profileImageUrl.startsWith(profileImagesPrefix)) return;

  const resolvedUploadsRoot = `${path.resolve(uploadsRoot)}${path.sep}`;
  const filePath = path.resolve(uploadsRoot, profileImageUrl.replace(/^\/uploads\//, ''));
  if (!filePath.startsWith(resolvedUploadsRoot)) return;

  try {
    await fs.unlink(filePath);
  } catch (err) {
    if (err.code !== 'ENOENT') {
      logger.warn({ err, filePath }, 'Failed to delete previous profile image');
    }
  }
};

const getProfile = async (userId) => {
  const user = await userRepo.findById(userId);
  if (!user) throw new AppError('User not found', 404);
  return user;
};

const updateProfile = async (userId, payload) => {
  const existingUser = await userRepo.findById(userId);
  const user = await userRepo.updateUser(userId, payload);
  if (!user) throw new AppError('User not found', 404);

  if (
    Object.prototype.hasOwnProperty.call(payload, 'profileImageUrl') &&
    existingUser?.profileImageUrl &&
    existingUser.profileImageUrl !== user.profileImageUrl
  ) {
    await deleteProfileImageFile(existingUser.profileImageUrl);
  }

  return user;
};

const updateUserStatus = async (userId, payload) => {
  if (!Object.prototype.hasOwnProperty.call(payload, 'isActive')) {
    throw new AppError('isActive is required', 400);
  }
  const updates = { isActive: payload.isActive };
  if (payload.isActive === false) {
    updates.deactivatedAt = new Date();
  } else if (payload.isActive === true) {
    updates.deactivatedAt = null;
  }
  const user = await userRepo.updateUser(userId, updates);
  if (!user) throw new AppError('User not found', 404);
  return user;
};

const normalizeList = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
};

const getStats = async (userId) => {
  const stats = await userRepo.getStatsByUserId(userId);
  return stats || {
    userId,
    age: null,
    gender: null,
    activityLevel: null,
    goal: null,
    heightCm: null,
    weightKg: null,
    mealPreferences: [],
    mealAllergies: [],
    mealDislikes: [],
  };
};

const buildNutritionPayload = (payload) => {
  const nutritionPayload = {};

  if (Object.prototype.hasOwnProperty.call(payload, 'age')) {
    nutritionPayload.age = payload.age ?? null;
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'gender')) {
    nutritionPayload.gender = payload.gender ?? null;
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'activityLevel')) {
    nutritionPayload.activityLevel = payload.activityLevel ?? null;
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'goal')) {
    nutritionPayload.goal = payload.goal ?? null;
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'heightCm')) {
    nutritionPayload.heightCm = payload.heightCm ?? null;
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'weightKg')) {
    nutritionPayload.weightKg = payload.weightKg ?? null;
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'mealPreferences')) {
    nutritionPayload.mealPreferences = JSON.stringify(normalizeList(payload.mealPreferences));
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'mealAllergies')) {
    nutritionPayload.mealAllergies = JSON.stringify(normalizeList(payload.mealAllergies));
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'mealDislikes')) {
    nutritionPayload.mealDislikes = JSON.stringify(normalizeList(payload.mealDislikes));
  }

  return nutritionPayload;
};

const tryGenerateMealPlan = async (userId) => {
  try {
    const plan = await mealService.generateAndStoreMealPlan({ userId });
    return {
      generated: true,
      planId: plan.id,
    };
  } catch (err) {
    if (err instanceof AppError && [404, 422].includes(err.statusCode)) {
      logger.warn({ userId, err }, 'Meal plan generation skipped after stats save');
      return {
        generated: false,
        reason: err.message,
      };
    }

    throw err;
  }
};

const createStats = async (userId, payload) => {
  const existing = await userRepo.getStatsByUserId(userId);
  if (existing) throw new AppError('Stats already exist', 409);
  const statsPayload = buildNutritionPayload(payload);
  const stats = await userRepo.createStats(userId, {
    age: statsPayload.age ?? null,
    gender: statsPayload.gender ?? null,
    activityLevel: statsPayload.activityLevel ?? null,
    goal: statsPayload.goal ?? null,
    heightCm: statsPayload.heightCm ?? null,
    weightKg: statsPayload.weightKg ?? null,
    mealPreferences: statsPayload.mealPreferences ?? JSON.stringify([]),
    mealAllergies: statsPayload.mealAllergies ?? JSON.stringify([]),
    mealDislikes: statsPayload.mealDislikes ?? JSON.stringify([]),
  });
  if (statsPayload.weightKg !== undefined && statsPayload.weightKg !== null) {
    await userRepo.createWeightLog(userId, statsPayload.weightKg, new Date());
  }
  await tryGenerateMealPlan(userId);
  return stats;
};

const updateStats = async (userId, payload) => {
  const existing = await userRepo.getStatsByUserId(userId);
  if (!existing) throw new AppError('Stats not found', 404);
  const statsPayload = buildNutritionPayload(payload);
  const stats = await userRepo.updateStats(userId, statsPayload);
  if (Object.prototype.hasOwnProperty.call(statsPayload, 'weightKg') && statsPayload.weightKg !== null) {
    await userRepo.createWeightLog(userId, statsPayload.weightKg, new Date());
  }
  await tryGenerateMealPlan(userId);
  return stats;
};

const getHealthProfile = async (userId) => {
  return getStats(userId);
};

const createHealthProfile = async (userId, payload) => {
  return createStats(userId, payload);
};

const updateHealthProfile = async (userId, payload) => {
  return updateStats(userId, payload);
};

const getHealthData = async (userId) => {
  return getStats(userId);
};

const createHealthData = async (userId, payload) => {
  return createStats(userId, payload);
};

const updateHealthData = async (userId, payload) => {
  return updateStats(userId, payload);
};

const exportUserData = async (userId) => {
  const user = await userRepo.findById(userId);
  if (!user) throw new AppError('User not found', 404);
  return userRepo.exportUserData(userId);
};

const deactivateUserAccount = async (userId) => {
  const user = await userRepo.findById(userId);
  if (!user) throw new AppError('User not found', 404);
  await userRepo.updateUser(userId, {
    isActive: false,
    deactivatedAt: new Date(),
  });
  return {
    message: 'Account is deactivated',
    // user: updated,
  };
};

const deleteUserAccount = async (userId) => {
  const user = await userRepo.findById(userId);
  if (!user) throw new AppError('User not found', 404);
  await userRepo.deleteUserById(userId);
  return { message: 'Account deleted' };
};

module.exports = {
  getProfile,
  updateProfile,
  updateUserStatus,
  getHealthData,
  createHealthData,
  updateHealthData,
  getStats,
  createStats,
  updateStats,
  getHealthProfile,
  createHealthProfile,
  updateHealthProfile,
  exportUserData,
  deactivateUserAccount,
  deleteUserAccount,
  listWeightLogs: async (userId, startDate, endDate) => userRepo.listWeightLogs(userId, startDate, endDate),
};
