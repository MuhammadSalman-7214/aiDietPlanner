const { seedUSDAFoods } = require('../jobs/seedUSDAFoods');
const { seedOpenFoodFacts } = require('../jobs/seedOpenFoodFacts');

const initFoodsIfEmpty = async ({ recoverExistingFoods = false } = {}) => {
  try {
    const usdaResult = await seedUSDAFoods({
      skipIfFoodsExist: true,
      recoverExistingFoods,
    });
    let offResult = {
      inserted: 0,
      skipped: 0,
      alreadySeeded: true,
      metrics: null,
    };
    try {
      offResult = await seedOpenFoodFacts();
    } catch (offErr) {
      console.warn(`Open Food Facts bootstrap skipped: ${offErr.message}`);
    }

    console.log(
      `Food bootstrap complete: USDA ${usdaResult.inserted} inserted, ${usdaResult.skipped} skipped, ${usdaResult.upgraded || 0} recovered; OFF ${offResult.inserted} inserted, ${offResult.skipped} skipped`,
    );
    if (usdaResult.metrics) {
      console.log(
        `Food metrics: total=${usdaResult.metrics.totalFoods}, valid=${usdaResult.metrics.validFoods}, assumed100g=${usdaResult.metrics.assumed100gFoods}, invalid=${usdaResult.metrics.stillInvalidFoods}`,
      );
    }
    return {
      usdaResult,
      offResult,
    };
  } catch (err) {
    console.error('Food bootstrap failed:', err.message);
    throw err;
  }
};

module.exports = { initFoodsIfEmpty };
