const authService = require('./auth.service');

const register = async (req, res, next) => {
  try {
    const result = await authService.register(req.body);
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

const login = async (req, res, next) => {
  try {
    const result = await authService.login(req.body);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

const verifyOtp = async (req, res, next) => {
  try {
    const result = await authService.verifyOtp(req.body);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

const resendOtp = async (req, res, next) => {
  try {
    const result = await authService.resendOtp(req.body);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

const updatePassword = async (req, res, next) => {
  try {
    const result = await authService.updatePassword({
      userId: req.user.id,
      currentPassword: req.body.currentPassword,
      newPassword: req.body.newPassword,
    });
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

const requestPasswordReset = async (req, res, next) => {
  try {
    const result = await authService.requestPasswordReset(req.body);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

const confirmPasswordReset = async (req, res, next) => {
  try {
    const result = await authService.confirmPasswordReset(req.body);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  register,
  login,
  verifyOtp,
  resendOtp,
  updatePassword,
  requestPasswordReset,
  confirmPasswordReset,
};
