const logger = require('../../utils/logger');

const processReminderJob = async () => {
  logger.info('Reminder processor no-op');
  return true;
};

module.exports = { processReminderJob };
