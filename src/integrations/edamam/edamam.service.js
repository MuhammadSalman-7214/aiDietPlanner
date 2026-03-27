const logger = require('../../utils/logger');

const searchFood = async () => {
  if (!process.env.EDAMAM_APP_ID || !process.env.EDAMAM_APP_KEY) {
    logger.warn('Edamam integration not configured');
    return [];
  }
  return [];
};

module.exports = { searchFood };
