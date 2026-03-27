const FoodLog = require('./foodlog.model');
const UserProgress = require('./userprogress.model');

const createFoodLog = async (data) => FoodLog.create(data);

const findLogsForDate = async (userId, dateStart, dateEnd) => FoodLog.find({
  user: userId,
  loggedAt: { $gte: dateStart, $lte: dateEnd },
});

const upsertProgress = async ({ userId, date, targetCalories, consumedCalories }) => UserProgress.findOneAndUpdate(
  { user: userId, date },
  { targetCalories, consumedCalories },
  { upsert: true, new: true },
);

const findProgress = async (userId, date) => UserProgress.findOne({ user: userId, date });

module.exports = { createFoodLog, findLogsForDate, upsertProgress, findProgress };
