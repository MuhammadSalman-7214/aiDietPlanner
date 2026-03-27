const logger = require('../../utils/logger');

const enqueueReminderJob = async () => {
  logger.info('Reminder queue disabled (no worker configured)');
  return null;
};

module.exports = { enqueueReminderJob };
