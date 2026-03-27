const { getRedisClient } = require('./redis');

const getBullmqConnection = () => {
  const client = getRedisClient();
  if (!client) return null;
  return {
    connection: {
      host: client.options?.socket?.host,
      port: client.options?.socket?.port,
      username: client.options?.username,
      password: client.options?.password,
      tls: client.options?.tls,
    },
  };
};

module.exports = { getBullmqConnection };
