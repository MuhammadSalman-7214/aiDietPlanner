const test = require("node:test");
const assert = require("node:assert/strict");

const {
  formatEssentialMealPlanResponse,
  selectBalancedMealItems,
} = require("./meal.service");

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

test("meal formatter normalizes display names and omits empty daily gaps", () => {
  const formatted = formatEssentialMealPlanResponse({
    nutrition: {
      targetCalories: 250,
      macros: {
        protein: 25,
        carbs: 20,
        fats: 5,
      },
    },
    breakfast: {
      items: [
        {
          id: 71,
          name: "CINNAMON CORNMEAL INSTANT PORRIDGE, CINNAMON",
          calories: 250,
          protein: 10,
          carbs: 30,
          fats: 5,
          weightGrams: 100,
        },
      ],
      totals: {
        calories: 250,
        protein: 10,
        carbs: 30,
        fats: 5,
      },
    },
    lunch: { items: [], totals: { calories: 0, protein: 0, carbs: 0, fats: 0 } },
    dinner: { items: [], totals: { calories: 0, protein: 0, carbs: 0, fats: 0 } },
    snacks: [],
  });

  assert.equal(formatted.meals[0].items[0].name, "Cinnamon Cornmeal Instant Porridge");
  assert.equal(Object.prototype.hasOwnProperty.call(formatted.actualDailyTotals, "gap"), false);
});

test("meal formatter emits simplified swap suggestions without self-swaps", () => {
  const formatted = formatEssentialMealPlanResponse({
    nutrition: {
      targetCalories: 250,
      macros: {
        protein: 25,
        carbs: 20,
        fats: 5,
      },
    },
    breakfast: {
      items: [
        {
          id: 81,
          name: "CINNAMON CORNMEAL INSTANT PORRIDGE, CINNAMON",
          calories: 250,
          protein: 10,
          carbs: 30,
          fats: 5,
          weightGrams: 100,
        },
      ],
      totals: {
        calories: 250,
        protein: 10,
        carbs: 30,
        fats: 5,
      },
    },
    lunch: { items: [], totals: { calories: 0, protein: 0, carbs: 0, fats: 0 } },
    dinner: { items: [], totals: { calories: 0, protein: 0, carbs: 0, fats: 0 } },
    snacks: [],
    alternatives: {
      breakfast: [
        {
          currentItem: {
            id: 81,
            name: "CINNAMON CORNMEAL INSTANT PORRIDGE, CINNAMON",
            calories: 250,
            protein: 10,
            carbs: 30,
            fats: 5,
          },
          originalItemId: 81,
          components: [
            {
              recommended: {
                id: 82,
                name: "OAT PORRIDGE",
                calories: 200,
                protein: 7,
                carbs: 34,
                fats: 5,
                matchScore: 0.9,
                isSafeSwap: true,
              },
              alternatives: [
                {
                  id: 81,
                  name: "CINNAMON CORNMEAL INSTANT PORRIDGE, CINNAMON",
                  calories: 250,
                  protein: 10,
                  carbs: 30,
                  fats: 5,
                  matchScore: 1,
                  isSafeSwap: true,
                },
                {
                  id: 82,
                  name: "OAT PORRIDGE",
                  calories: 200,
                  protein: 7,
                  carbs: 34,
                  fats: 5,
                  matchScore: 0.9,
                  isSafeSwap: true,
                },
                {
                  id: 83,
                  name: "CREAMY PORRIDGE",
                  calories: 205,
                  protein: 8,
                  carbs: 33,
                  fats: 6,
                  matchScore: 0.8,
                  isSafeSwap: true,
                },
              ],
              isSafeSwap: true,
              reason: null,
            },
          ],
        },
      ],
      lunch: [],
      dinner: [],
      snacks: [],
    },
  });

  assert.equal(formatted.swapSuggestions.length, 1);
  assert.deepEqual(Object.keys(formatted.swapSuggestions[0].currentItem), ["id", "name", "calories", "protein", "carbs", "fats"]);
  assert.equal(formatted.swapSuggestions[0].currentItem.name, "Cinnamon Cornmeal Instant Porridge");
  assert.equal(formatted.swapSuggestions[0].alternatives.some((alt) => alt.id === 81), false);
  assert.equal(formatted.swapSuggestions[0].alternatives.length >= 2, true);
});
