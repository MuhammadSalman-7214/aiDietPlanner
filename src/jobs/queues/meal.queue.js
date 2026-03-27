const logger = require('../../utils/logger');

const enqueueMealJob = async () => {
  logger.info('Meal queue disabled (no worker configured)');
  return null;
};

module.exports = { enqueueMealJob };
