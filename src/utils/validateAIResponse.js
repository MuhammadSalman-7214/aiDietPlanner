const validateAIMealSuggestion = (suggestion, targetCalories) => {
  if (!suggestion || typeof suggestion !== 'object') return false;
  const { calories, protein, carbs, fats } = suggestion;
  const hasNumbers = [calories, protein, carbs, fats].every((n) => Number.isFinite(n));
  if (!hasNumbers) return false;
  const withinCalories = calories >= targetCalories * 0.8 && calories <= targetCalories * 1.2;
  return withinCalories;
};

module.exports = { validateAIMealSuggestion };
