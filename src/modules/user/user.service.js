const bcrypt = require('bcryptjs');
const { AppError } = require('../../middlewares/error.middleware');
const userRepo = require('./user.repository');

const getProfile = async (userId) => {
  const user = await userRepo.findById(userId);
  if (!user) throw new AppError('User not found', 404);
  return user;
};

const updateProfile = async (userId, payload) => {
  if (payload.password) {
    payload.passwordHash = await bcrypt.hash(payload.password, 10);
    delete payload.password;
  }
  const user = await userRepo.updateUser(userId, payload);
  if (!user) throw new AppError('User not found', 404);
  return user;
};

const updateUserStatus = async (userId, payload) => {
  if (!Object.prototype.hasOwnProperty.call(payload, 'isActive')) {
    throw new AppError('isActive is required', 400);
  }
  const user = await userRepo.updateUser(userId, { isActive: payload.isActive });
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
    heightCm: null,
    weightKg: null,
    mealPreferences: [],
    mealAllergies: [],
  };
};

const buildStatsPayload = (payload) => {
  const statsPayload = {};
  if (Object.prototype.hasOwnProperty.call(payload, 'heightCm')) {
    statsPayload.heightCm = payload.heightCm ?? null;
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'weightKg')) {
    statsPayload.weightKg = payload.weightKg ?? null;
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'mealPreferences')) {
    statsPayload.mealPreferences = JSON.stringify(normalizeList(payload.mealPreferences));
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'mealAllergies')) {
    statsPayload.mealAllergies = JSON.stringify(normalizeList(payload.mealAllergies));
  }
  return statsPayload;
};

const buildProfilePayload = (payload) => {
  const profilePayload = {};
  if (Object.prototype.hasOwnProperty.call(payload, 'age')) {
    profilePayload.age = payload.age ?? null;
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'gender')) {
    profilePayload.gender = payload.gender ?? null;
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'activityLevel')) {
    profilePayload.activityLevel = payload.activityLevel ?? null;
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'goal')) {
    profilePayload.goal = payload.goal ?? null;
  }
  return profilePayload;
};

const createStats = async (userId, payload) => {
  const existing = await userRepo.getStatsByUserId(userId);
  if (existing) throw new AppError('Stats already exist', 409);
  const statsPayload = buildStatsPayload(payload);
  const stats = await userRepo.createStats(userId, {
    heightCm: statsPayload.heightCm ?? null,
    weightKg: statsPayload.weightKg ?? null,
    mealPreferences: statsPayload.mealPreferences ?? JSON.stringify([]),
    mealAllergies: statsPayload.mealAllergies ?? JSON.stringify([]),
  });
  if (statsPayload.weightKg !== undefined && statsPayload.weightKg !== null) {
    await userRepo.createWeightLog(userId, statsPayload.weightKg, new Date());
  }
  return stats;
};

const updateStats = async (userId, payload) => {
  const existing = await userRepo.getStatsByUserId(userId);
  if (!existing) throw new AppError('Stats not found', 404);
  const statsPayload = buildStatsPayload(payload);
  const stats = await userRepo.updateStats(userId, statsPayload);
  if (Object.prototype.hasOwnProperty.call(statsPayload, 'weightKg') && statsPayload.weightKg !== null) {
    await userRepo.createWeightLog(userId, statsPayload.weightKg, new Date());
  }
  return stats;
};

const getHealthProfile = async (userId) => {
  const profile = await userRepo.getProfileByUserId(userId);
  return profile || {
    userId,
    age: null,
    gender: null,
    activityLevel: null,
    goal: null,
  };
};

const createHealthProfile = async (userId, payload) => {
  const existing = await userRepo.getProfileByUserId(userId);
  if (existing) throw new AppError('Profile already exists', 409);
  const profile = await userRepo.createProfile(userId, payload);
  return profile;
};

const updateHealthProfile = async (userId, payload) => {
  const existing = await userRepo.getProfileByUserId(userId);
  if (!existing) throw new AppError('Profile not found', 404);
  const profile = await userRepo.updateProfileData(userId, payload);
  return profile;
};

const getHealthData = async (userId) => {
  const [profile, stats] = await Promise.all([
    userRepo.getProfileByUserId(userId),
    userRepo.getStatsByUserId(userId),
  ]);

  return {
    userId,
    age: profile ? profile.age : null,
    gender: profile ? profile.gender : null,
    activityLevel: profile ? profile.activityLevel : null,
    goal: profile ? profile.goal : null,
    heightCm: stats ? stats.heightCm : null,
    weightKg: stats ? stats.weightKg : null,
    mealPreferences: stats ? stats.mealPreferences : [],
    mealAllergies: stats ? stats.mealAllergies : [],
  };
};

const createHealthData = async (userId, payload) => {
  const [existingProfile, existingStats] = await Promise.all([
    userRepo.getProfileByUserId(userId),
    userRepo.getStatsByUserId(userId),
  ]);

  if (existingProfile || existingStats) {
    throw new AppError('Health data already exists', 409);
  }

  const profilePayload = buildProfilePayload(payload);
  const statsPayload = buildStatsPayload(payload);

  await userRepo.createProfile(userId, {
    age: profilePayload.age ?? null,
    gender: profilePayload.gender ?? null,
    activityLevel: profilePayload.activityLevel ?? null,
    goal: profilePayload.goal ?? null,
  });

  await userRepo.createStats(userId, {
    heightCm: statsPayload.heightCm ?? null,
    weightKg: statsPayload.weightKg ?? null,
    mealPreferences: statsPayload.mealPreferences ?? JSON.stringify([]),
    mealAllergies: statsPayload.mealAllergies ?? JSON.stringify([]),
  });

  if (statsPayload.weightKg !== undefined && statsPayload.weightKg !== null) {
    await userRepo.createWeightLog(userId, statsPayload.weightKg, new Date());
  }

  return getHealthData(userId);
};

const updateHealthData = async (userId, payload) => {
  const [existingProfile, existingStats] = await Promise.all([
    userRepo.getProfileByUserId(userId),
    userRepo.getStatsByUserId(userId),
  ]);

  const profilePayload = buildProfilePayload(payload);
  const statsPayload = buildStatsPayload(payload);

  if (Object.keys(profilePayload).length) {
    if (existingProfile) {
      await userRepo.updateProfileData(userId, profilePayload);
    } else {
      await userRepo.createProfile(userId, {
        age: profilePayload.age ?? null,
        gender: profilePayload.gender ?? null,
        activityLevel: profilePayload.activityLevel ?? null,
        goal: profilePayload.goal ?? null,
      });
    }
  }

  if (Object.keys(statsPayload).length) {
    if (existingStats) {
      await userRepo.updateStats(userId, statsPayload);
    } else {
      await userRepo.createStats(userId, {
        heightCm: statsPayload.heightCm ?? null,
        weightKg: statsPayload.weightKg ?? null,
        mealPreferences: statsPayload.mealPreferences ?? JSON.stringify([]),
        mealAllergies: statsPayload.mealAllergies ?? JSON.stringify([]),
      });
    }
  }

  if (Object.prototype.hasOwnProperty.call(statsPayload, 'weightKg') && statsPayload.weightKg !== null) {
    await userRepo.createWeightLog(userId, statsPayload.weightKg, new Date());
  }

  return getHealthData(userId);
};

const exportUserData = async (userId) => {
  const user = await userRepo.findById(userId);
  if (!user) throw new AppError('User not found', 404);
  return userRepo.exportUserData(userId);
};

const deleteUserAccount = async (userId) => {
  const user = await userRepo.findById(userId);
  if (!user) throw new AppError('User not found', 404);
  const updated = await userRepo.updateUser(userId, { isActive: false });
  return { message: 'Account deactivated', user: updated };
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
  deleteUserAccount,
  listWeightLogs: async (userId, startDate, endDate) => userRepo.listWeightLogs(userId, startDate, endDate),
};
