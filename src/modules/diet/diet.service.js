const { calculateBMR, calculateTDEE, calculateTargetCalories, calculateMacros } = require('../../utils/calorieCalculator');

const calculateDiet = ({ age, gender, weight, height, activityLevel, goal }) => {
  const bmr = calculateBMR({ age, gender, weight, height });
  const tdee = calculateTDEE(bmr, activityLevel);
  const targetCalories = calculateTargetCalories(tdee, goal);
  const macros = calculateMacros(targetCalories, goal);

  return {
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    targetCalories: Math.round(targetCalories),
    macros,
  };
};

module.exports = { calculateDiet };
