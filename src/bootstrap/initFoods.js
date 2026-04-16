const { seedUSDAFoods } = require('../jobs/seedUSDAFoods');

const initFoodsIfEmpty = async () => {
  try {
    const result = await seedUSDAFoods({ skipIfFoodsExist: true });
    if (result.alreadySeeded) {
      console.log('Foods already exist. Skipping bootstrap seed.');
      return result;
    }

    console.log(`Food bootstrap complete: ${result.inserted} inserted, ${result.skipped} skipped`);
    return result;
  } catch (err) {
    console.error('Food bootstrap failed:', err.message);
    throw err;
  }
};

module.exports = { initFoodsIfEmpty };
