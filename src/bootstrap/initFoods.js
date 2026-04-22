const { seedUSDAFoods } = require('../jobs/seedUSDAFoods');

const initFoodsIfEmpty = async ({ recoverExistingFoods = false } = {}) => {
  try {
    const result = await seedUSDAFoods({
      skipIfFoodsExist: true,
      recoverExistingFoods,
    });
    if (result.alreadySeeded) {
      console.log('Foods already exist. Skipping bootstrap on startup.');
      return result;
    }

    console.log(
      `Food bootstrap complete: ${result.inserted} inserted, ${result.skipped} skipped, ${result.upgraded || 0} recovered`,
    );
    if (result.metrics) {
      console.log(
        `Food metrics: total=${result.metrics.totalFoods}, valid=${result.metrics.validFoods}, assumed100g=${result.metrics.assumed100gFoods}, invalid=${result.metrics.stillInvalidFoods}`,
      );
    }
    return result;
  } catch (err) {
    console.error('Food bootstrap failed:', err.message);
    throw err;
  }
};

module.exports = { initFoodsIfEmpty };
