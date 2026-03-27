const { createClient } = require('redis');
const logger = require('../utils/logger');

let redisClient;

const initRedis = async () => {
  const url = process.env.REDIS_URL;
  if (!url) {
    logger.warn('REDIS_URL not set. Redis cache disabled.');
    return null;
  }

  if (redisClient) return redisClient;

  redisClient = createClient({ url });
  redisClient.on('error', (err) => logger.error({ err }, 'Redis error'));
  await redisClient.connect();
  logger.info('Redis connected');
  return redisClient;
};

const getRedisClient = () => redisClient;

module.exports = { initRedis, getRedisClient };
