const logger = require('../../utils/logger');

const startReminderWorker = () => {
  logger.info('Reminder worker disabled');
};

module.exports = { startReminderWorker };
