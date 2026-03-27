require('dotenv').config();
const app = require('./src/app');
const { connectDB } = require('./src/config/db');
const { initRedis } = require('./src/config/redis');
const logger = require('./src/utils/logger');

const PORT = process.env.PORT || 4000;

(async () => {
  try {
    await connectDB();
    await initRedis();
    app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
    });
  } catch (err) {
    logger.error({ err }, 'Failed to start server');
    process.exit(1);
  }
})();
