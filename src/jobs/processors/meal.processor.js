const logger = require('../../utils/logger');

const processMealJob = async () => {
  logger.info('Meal processor no-op');
  return true;
};

module.exports = { processMealJob };
