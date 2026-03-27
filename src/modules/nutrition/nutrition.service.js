const { AppError } = require('../../middlewares/error.middleware');
const nutritionRepo = require('./nutrition.repository');

const getDateRange = (dateStr) => {
  const date = dateStr ? new Date(dateStr) : new Date();
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return { start, end, dateKey: start.toISOString().slice(0, 10) };
};

const logFood = async ({ userId, name, calories, protein = 0, carbs = 0, fats = 0, targetCalories, date }) => {
  if (!targetCalories) throw new AppError('targetCalories is required', 400);

  const { start, end, dateKey } = getDateRange(date);
  const logTime = date ? new Date(date) : new Date();
  await nutritionRepo.createFoodLog({ user: userId, name, calories, protein, carbs, fats, loggedAt: logTime });

  const logs = await nutritionRepo.findLogsForDate(userId, start, end);
  const consumedCalories = logs.reduce((sum, log) => sum + log.calories, 0);

  const progress = await nutritionRepo.upsertProgress({
    userId,
    date: dateKey,
    targetCalories,
    consumedCalories,
  });

  return { logs, progress };
};

const getDailySummary = async ({ userId, date }) => {
  const { start, end, dateKey } = getDateRange(date);
  const logs = await nutritionRepo.findLogsForDate(userId, start, end);
  const consumedCalories = logs.reduce((sum, log) => sum + log.calories, 0);
  const progress = await nutritionRepo.findProgress(userId, dateKey);

  return {
    date: dateKey,
    consumedCalories,
    targetCalories: progress?.targetCalories || null,
    logs,
  };
};

const analyzeDaily = async ({ userId, date }) => {
  const { start, end, dateKey } = getDateRange(date);
  const logs = await nutritionRepo.findLogsForDate(userId, start, end);
  const consumedCalories = logs.reduce((sum, log) => sum + log.calories, 0);
  const progress = await nutritionRepo.findProgress(userId, dateKey);

  if (!progress) {
    return { date: dateKey, status: 'no_target', consumedCalories, targetCalories: null };
  }

  const ratio = consumedCalories / progress.targetCalories;
  let status = 'on_track';
  if (ratio < 0.8) status = 'under_eating';
  if (ratio > 1.1) status = 'over_eating';

  return {
    date: dateKey,
    status,
    consumedCalories,
    targetCalories: progress.targetCalories,
  };
};

module.exports = { logFood, getDailySummary, analyzeDaily };
