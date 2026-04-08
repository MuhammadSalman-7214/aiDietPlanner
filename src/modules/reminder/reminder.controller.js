const reminderService = require('./reminder.service');

const listReminders = async (req, res, next) => {
  try {
    const reminders = await reminderService.listReminders(req.user.id);
    res.json({ success: true, data: reminders });
  } catch (err) {
    next(err);
  }
};

const createReminder = async (req, res, next) => {
  try {
    const reminder = await reminderService.createReminder(req.user.id, req.body);
    res.status(201).json({ success: true, data: reminder });
  } catch (err) {
    next(err);
  }
};

const updateReminder = async (req, res, next) => {
  try {
    const reminder = await reminderService.updateReminder(req.user.id, req.params.id, req.body);
    res.json({ success: true, data: reminder });
  } catch (err) {
    next(err);
  }
};

const deleteReminder = async (req, res, next) => {
  try {
    const result = await reminderService.deleteReminder(req.user.id, req.params.id);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

module.exports = { listReminders, createReminder, updateReminder, deleteReminder };
