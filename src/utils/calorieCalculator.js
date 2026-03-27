const { DIET_GOALS, ACTIVITY_MULTIPLIER } = require('../constants/dietGoals');

const calculateBMR = ({ gender, weight, height, age }) => {
  const base = 10 * weight + 6.25 * height - 5 * age;
  return gender === 'male' ? base + 5 : base - 161;
};

const calculateTDEE = (bmr, activityLevel) => {
  const multiplier = ACTIVITY_MULTIPLIER[activityLevel] || 1.2;
  return bmr * multiplier;
};

const calculateTargetCalories = (tdee, goal) => {
  const adjustment = DIET_GOALS[goal] ?? 0;
  return Math.max(1200, tdee + adjustment);
};

const calculateMacros = (targetCalories, goal) => {
  let proteinRatio = 0.3;
  let fatRatio = 0.25;
  let carbRatio = 0.45;

  if (goal === 'loss') {
    proteinRatio = 0.35;
    fatRatio = 0.25;
    carbRatio = 0.4;
  }

  if (goal === 'gain') {
    proteinRatio = 0.3;
    fatRatio = 0.25;
    carbRatio = 0.45;
  }

  const protein = Math.round((targetCalories * proteinRatio) / 4);
  const carbs = Math.round((targetCalories * carbRatio) / 4);
  const fats = Math.round((targetCalories * fatRatio) / 9);

  return { protein, carbs, fats };
};

module.exports = {
  calculateBMR,
  calculateTDEE,
  calculateTargetCalories,
  calculateMacros,
};
