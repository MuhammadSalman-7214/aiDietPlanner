const test = require("node:test");
const assert = require("node:assert/strict");

const { selectBalancedMealItems } = require("./meal.service");

const buildFood = (overrides) => ({
  category: "breakfast",
  dietType: "any",
  nutritionStatus: "valid",
  confidence: 0.9,
  weightGrams: 100,
  ...overrides,
});

test("meal selection is deterministic when the same foods arrive in different orders", () => {
  const foods = [
    buildFood({
      id: 1,
      name: "Alpha Protein Bowl",
      calories: 264,
      protein: 30,
      carbs: 18,
      fats: 8,
    }),
    buildFood({
      id: 2,
      name: "Beta Protein Bowl",
      calories: 264,
      protein: 30,
      carbs: 18,
      fats: 8,
    }),
    buildFood({
      id: 3,
      name: "Rice Bowl",
      calories: 264,
      protein: 10,
      carbs: 38,
      fats: 8,
    }),
    buildFood({
      id: 4,
      name: "Oats Bowl",
      calories: 264,
      protein: 10,
      carbs: 38,
      fats: 8,
    }),
  ];

  const first = selectBalancedMealItems({
    foods,
    mealCategory: "breakfast",
    targetCalories: 528,
    preferences: [],
  });

  const second = selectBalancedMealItems({
    foods: [...foods].reverse(),
    mealCategory: "breakfast",
    targetCalories: 528,
    preferences: [],
  });

  assert.deepEqual(first.items.map((item) => item.name), ["Alpha Protein Bowl", "Oats Bowl"]);
  assert.deepEqual(second.items.map((item) => item.name), ["Alpha Protein Bowl", "Oats Bowl"]);
  assert.deepEqual(second.items.map((item) => item.name), first.items.map((item) => item.name));
});

test("meal selection hits the requested calorie target on a simple food pool", () => {
  const foods = [
    buildFood({
      id: 11,
      name: "Lean Protein Plate",
      calories: 200,
      protein: 30,
      carbs: 10,
      fats: 4,
    }),
    buildFood({
      id: 12,
      name: "Carb Plate",
      calories: 150,
      protein: 10,
      carbs: 25,
      fats: 3,
    }),
    buildFood({
      id: 13,
      name: "Fat Plate",
      calories: 100,
      protein: 4,
      carbs: 6,
      fats: 8,
    }),
  ];

  const selection = selectBalancedMealItems({
    foods,
    mealCategory: "breakfast",
    targetCalories: 450,
    preferences: [],
  });

  assert.equal(Math.round(selection.totals.calories), 450);
  assert.equal(Math.abs(selection.totals.calories - 450) <= 0.1, true);
});
