const { connectDB } = require('../config/db');
const { createFood } = require('../modules/meal/meal.repository');

const seedFoods = [
  { name: 'Oatmeal with Berries', calories: 320, protein: 12, carbs: 50, fats: 8, category: 'breakfast', dietType: 'vegetarian' },
  { name: 'Greek Yogurt Parfait', calories: 280, protein: 18, carbs: 30, fats: 8, category: 'breakfast', dietType: 'balanced' },
  { name: 'Egg White Omelette', calories: 260, protein: 24, carbs: 6, fats: 10, category: 'breakfast', dietType: 'keto' },
  { name: 'Chicken Salad Bowl', calories: 420, protein: 35, carbs: 20, fats: 18, category: 'lunch', dietType: 'balanced' },
  { name: 'Quinoa Veggie Bowl', calories: 450, protein: 18, carbs: 60, fats: 12, category: 'lunch', dietType: 'vegan' },
  { name: 'Grilled Salmon Plate', calories: 520, protein: 40, carbs: 18, fats: 28, category: 'dinner', dietType: 'mediterranean' },
  { name: 'Turkey Stir Fry', calories: 480, protein: 38, carbs: 35, fats: 16, category: 'dinner', dietType: 'balanced' },
  { name: 'Tofu Curry', calories: 430, protein: 22, carbs: 40, fats: 18, category: 'dinner', dietType: 'vegan' },
  { name: 'Mixed Nuts', calories: 180, protein: 6, carbs: 8, fats: 14, category: 'snack', dietType: 'balanced' },
  { name: 'Protein Shake', calories: 220, protein: 25, carbs: 12, fats: 6, category: 'snack', dietType: 'balanced' },
  { name: 'Apple with Peanut Butter', calories: 200, protein: 6, carbs: 22, fats: 10, category: 'snack', dietType: 'vegetarian' },
];

const seed = async () => {
  await connectDB();

  let inserted = 0;
  for (const food of seedFoods) {
    await createFood({
      ...food,
      dietType: food.dietType || 'any',
    });
    inserted += 1;
  }

  console.log(`Static foods seeded: ${inserted} inserted`);
  return { inserted };
};

if (require.main === module) {
  seed()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Static food seed failed:', err);
      process.exit(1);
    });
}

module.exports = { seedFoods: seed };
