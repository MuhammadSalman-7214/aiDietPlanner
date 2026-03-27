const bcrypt = require('bcryptjs');
const { AppError } = require('../../middlewares/error.middleware');
const authRepo = require('./auth.repository');
const { generateToken } = require('../../utils/generateToken');

const register = async ({ name, email, password }) => {
  const existing = await authRepo.findByEmail(email);
  if (existing) throw new AppError('Email already in use', 409);

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await authRepo.createUser({ name, email, passwordHash });

  const token = generateToken({ id: user._id, email: user.email });
  return { user: { id: user._id, name: user.name, email: user.email }, token };
};

const login = async ({ email, password }) => {
  const user = await authRepo.findByEmail(email);
  if (!user) throw new AppError('Invalid credentials', 401);

  const match = await bcrypt.compare(password, user.passwordHash);
  if (!match) throw new AppError('Invalid credentials', 401);

  const token = generateToken({ id: user._id, email: user.email });
  return { user: { id: user._id, name: user.name, email: user.email }, token };
};

module.exports = { register, login };
