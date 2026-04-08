const { AppError } = require('../../middlewares/error.middleware');
const reminderRepo = require('./reminder.repository');

const listReminders = async (userId) => reminderRepo.listReminders(userId);

const createReminder = async (userId, payload) => {
  if (!payload.scheduledAt) throw new AppError('scheduledAt is required', 400);
  return reminderRepo.createReminder(userId, payload);
};

const updateReminder = async (userId, reminderId, payload) => {
  const updated = await reminderRepo.updateReminder(userId, reminderId, payload);
  if (!updated) throw new AppError('Reminder not found', 404);
  return updated;
};

const deleteReminder = async (userId, reminderId) => {
  await reminderRepo.deleteReminder(userId, reminderId);
  return { message: 'Reminder deleted' };
};

module.exports = { listReminders, createReminder, updateReminder, deleteReminder };
