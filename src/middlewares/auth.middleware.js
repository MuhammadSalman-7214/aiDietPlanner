const jwt = require('jsonwebtoken');
const { AppError } = require('./error.middleware');
const userRepo = require('../modules/user/user.repository');

const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new AppError('Unauthorized', 401));
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await userRepo.findById(decoded.id);
    if (!user) {
      return next(new AppError('Unauthorized', 401));
    }
    if (user.isActive === false) {
      return next(new AppError('Account is inactive', 403));
    }
    if (user.passwordChangedAt) {
      const tokenIatMs = (decoded.iat || 0) * 1000;
      if (tokenIatMs && tokenIatMs < user.passwordChangedAt.getTime()) {
        return next(new AppError('Token expired', 401));
      }
    }
    req.user = {
      ...decoded,
      isPremium: user.isPremium,
      isActive: user.isActive,
    };
    return next();
  } catch (err) {
    return next(new AppError('Invalid or expired token', 401));
  }
};

const requirePremium = (req, res, next) => {
  if (!req.user?.isPremium) {
    return next(new AppError('Premium subscription required', 403));
  }
  return next();
};

module.exports = { authMiddleware, requirePremium };
