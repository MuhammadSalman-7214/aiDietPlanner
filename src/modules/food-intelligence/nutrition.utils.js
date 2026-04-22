const safeNumber = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
};

const roundValue = (value) => Math.round((Number(value) || 0) * 10) / 10;

const calculateCalories = (food = {}) =>
  roundValue(
    safeNumber(food.protein) * 4 +
    safeNumber(food.carbs) * 4 +
    safeNumber(food.fats) * 9,
  );

const normalizeCalories = (food = {}) => {
  const calculatedCalories = calculateCalories(food);
  const currentCalories = safeNumber(food.calories);

  if (!currentCalories) {
    return {
      ...food,
      calories: calculatedCalories,
    };
  }

  if (Math.abs(calculatedCalories - currentCalories) > 20) {
    return {
      ...food,
      calories: calculatedCalories,
    };
  }

  return {
    ...food,
    calories: currentCalories,
  };
};

module.exports = {
  calculateCalories,
  normalizeCalories,
  roundValue,
  safeNumber,
};
