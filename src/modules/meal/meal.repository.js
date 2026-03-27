const Food = require('./meal.model');

const findFoods = async (query) => Food.find(query);

module.exports = { findFoods };
