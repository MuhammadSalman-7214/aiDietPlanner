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

module.exports = { getProfile, updateProfile };
