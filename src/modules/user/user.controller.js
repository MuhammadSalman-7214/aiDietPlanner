const userService = require('./user.service');

const getProfile = async (req, res, next) => {
  try {
    const user = await userService.getProfile(req.user.id);
    res.json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
};

const updateProfile = async (req, res, next) => {
  try {
    const user = await userService.updateProfile(req.user.id, req.body);
    res.json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
};

const updateUserStatus = async (req, res, next) => {
  try {
    const user = await userService.updateUserStatus(req.user.id, req.body);
    res.json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
};

const getHealthData = async (req, res, next) => {
  try {
    const data = await userService.getHealthData(req.user.id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

const createHealthData = async (req, res, next) => {
  try {
    const data = await userService.createHealthData(req.user.id, req.body);
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

const updateHealthData = async (req, res, next) => {
  try {
    const data = await userService.updateHealthData(req.user.id, req.body);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

const getStats = async (req, res, next) => {
  try {
    const stats = await userService.getStats(req.user.id);
    res.json({ success: true, data: stats });
  } catch (err) {
    next(err);
  }
};

const createStats = async (req, res, next) => {
  try {
    const stats = await userService.createStats(req.user.id, req.body);
    res.status(201).json({ success: true, data: stats });
  } catch (err) {
    next(err);
  }
};

const updateStats = async (req, res, next) => {
  try {
    const stats = await userService.updateStats(req.user.id, req.body);
    res.json({ success: true, data: stats });
  } catch (err) {
    next(err);
  }
};

const getHealthProfile = async (req, res, next) => {
  try {
    const profile = await userService.getHealthProfile(req.user.id);
    res.json({ success: true, data: profile });
  } catch (err) {
    next(err);
  }
};

const createHealthProfile = async (req, res, next) => {
  try {
    const profile = await userService.createHealthProfile(req.user.id, req.body);
    res.status(201).json({ success: true, data: profile });
  } catch (err) {
    next(err);
  }
};

const updateHealthProfile = async (req, res, next) => {
  try {
    const profile = await userService.updateHealthProfile(req.user.id, req.body);
    res.json({ success: true, data: profile });
  } catch (err) {
    next(err);
  }
};

const exportUserData = async (req, res, next) => {
  try {
    const data = await userService.exportUserData(req.user.id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

const deactivateUserAccount = async (req, res, next) => {
  try {
    const result = await userService.deactivateUserAccount(req.user.id);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

const deleteUserAccount = async (req, res, next) => {
  try {
    const result = await userService.deleteUserAccount(req.user.id);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

const getWeightHistory = async (req, res, next) => {
  try {
    const start = req.query.start ? new Date(req.query.start) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = req.query.end ? new Date(req.query.end) : new Date();
    const data = await userService.listWeightLogs(req.user.id, start, end);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
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
  getWeightHistory,
};
