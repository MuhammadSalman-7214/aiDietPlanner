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

const getRangeByPeriod = (period, dateStr) => {
  const date = dateStr ? new Date(dateStr) : new Date();
  const start = new Date(date);
  const end = new Date(date);

  if (period === 'weekly') {
    const day = start.getDay();
    const diff = (day + 6) % 7;
    start.setDate(start.getDate() - diff);
    start.setHours(0, 0, 0, 0);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
  } else if (period === 'monthly') {
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    end.setMonth(start.getMonth() + 1, 0);
    end.setHours(23, 59, 59, 999);
  } else if (period === 'yearly') {
    start.setMonth(0, 1);
    start.setHours(0, 0, 0, 0);
    end.setMonth(11, 31);
    end.setHours(23, 59, 59, 999);
  } else {
    throw new AppError('Invalid period', 400);
  }

  const startKey = start.toISOString().slice(0, 10);
  const endKey = end.toISOString().slice(0, 10);
  return { start, end, startKey, endKey };
};

const calculateCalories = ({ calories, protein = 0, carbs = 0, fats = 0 }) => {
  if (calories && calories > 0) return calories;
  return protein * 4 + carbs * 4 + fats * 9;
};

const logFood = async ({ userId, name, calories, protein = 0, carbs = 0, fats = 0, targetCalories, date }) => {
  if (!targetCalories) throw new AppError('targetCalories is required', 400);

  const { start, end, dateKey } = getDateRange(date);
  const logTime = date ? new Date(date) : new Date();
  const computedCalories = calculateCalories({ calories, protein, carbs, fats });
  await nutritionRepo.createFoodLog({
    userId,
    name,
    calories: computedCalories,
    protein,
    carbs,
    fats,
    loggedAt: logTime,
  });

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

const getSummaryRange = async ({ userId, period, date }) => {
  const { start, end, startKey, endKey } = getRangeByPeriod(period, date);
  const logs = await nutritionRepo.findLogsForDate(userId, start, end);
  const consumedCalories = logs.reduce((sum, log) => sum + log.calories, 0);
  const progress = await nutritionRepo.findProgressRange(userId, startKey, endKey);
  const targetCalories = progress.reduce((sum, row) => sum + row.targetCalories, 0);

  return {
    period,
    start: startKey,
    end: endKey,
    consumedCalories,
    targetCalories,
    logs,
  };
};

const analyzeRange = async ({ userId, period, date }) => {
  const { start, end, startKey, endKey } = getRangeByPeriod(period, date);
  const progress = await nutritionRepo.findProgressRange(userId, startKey, endKey);
  const logs = await nutritionRepo.findLogsForDate(userId, start, end);
  const consumedCalories = logs.reduce((sum, log) => sum + log.calories, 0);
  const targetCalories = progress.reduce((sum, row) => sum + row.targetCalories, 0);

  if (!targetCalories) {
    return { period, start: startKey, end: endKey, status: 'no_target', consumedCalories, targetCalories: null };
  }

  const ratio = consumedCalories / targetCalories;
  let status = 'on_track';
  if (ratio < 0.8) status = 'under_eating';
  if (ratio > 1.1) status = 'over_eating';

  return { period, start: startKey, end: endKey, status, consumedCalories, targetCalories };
};

const getMissedTargets = async ({ userId, period, date }) => {
  const { startKey, endKey } = getRangeByPeriod(period, date);
  const progress = await nutritionRepo.findProgressRange(userId, startKey, endKey);
  return progress
    .filter((row) => row.consumedCalories < row.targetCalories)
    .map((row) => ({
      date: row.date,
      consumedCalories: row.consumedCalories,
      targetCalories: row.targetCalories,
      deficit: row.targetCalories - row.consumedCalories,
    }));
};

module.exports = {
  logFood,
  getDailySummary,
  analyzeDaily,
  getSummaryRange,
  analyzeRange,
  getMissedTargets,
};
