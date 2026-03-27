const { getRedisClient } = require('../config/redis');

const getCache = async (key) => {
  const client = getRedisClient();
  if (!client) return null;
  const value = await client.get(key);
  return value ? JSON.parse(value) : null;
};

const setCache = async (key, value, ttlSeconds = 3600) => {
  const client = getRedisClient();
  if (!client) return;
  await client.set(key, JSON.stringify(value), { EX: ttlSeconds });
};

module.exports = { getCache, setCache };
