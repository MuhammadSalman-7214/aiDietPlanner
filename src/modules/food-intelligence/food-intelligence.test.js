const test = require("node:test");
const assert = require("node:assert/strict");

const { extractComponents } = require("./component.engine");
const {
  buildItemAlternatives,
  filterCandidates,
  getValidAlternatives,
} = require("./food.alternative.service");
const { normalizeUsdaFood } = require("./food.usda.service");

test("Bagels, egg excludes egg-based alternatives and returns tofu or chicken", async () => {
  const item = normalizeUsdaFood({
    id: 1,
    name: "Bagels, egg",
    calories: 90,
    protein: 8,
    carbs: 2,
    fats: 6,
    weightGrams: 100,
    category: "breakfast",
    dietType: "balanced",
  });

  const result = await buildItemAlternatives({
    item,
    category: "breakfast",
    mealTotals: { calories: 300, protein: 20, carbs: 25, fats: 10 },
    dayTotals: { calories: 1200, protein: 80, carbs: 90, fats: 35 },
    foods: [
      { id: 2, name: "Egg white", calories: 55, protein: 11, carbs: 1, fats: 0, weightGrams: 100, category: "breakfast", dietType: "balanced" },
      { id: 3, name: "Tofu Scramble", calories: 76, protein: 8, carbs: 2, fats: 4, weightGrams: 100, category: "breakfast", dietType: "balanced" },
      { id: 4, name: "Beans Patty", calories: 88, protein: 7, carbs: 8, fats: 3, weightGrams: 100, category: "breakfast", dietType: "balanced" },
      { id: 5, name: "Chicken breast", calories: 80, protein: 15, carbs: 0, fats: 2, weightGrams: 100, category: "breakfast", dietType: "balanced" },
    ],
    limit: 5,
  });

  const eggBlock = result.components.find((component) => component.replaceableComponent === "egg");
  assert.ok(eggBlock);
  assert.equal(eggBlock.alternatives.some((candidate) => /egg/i.test(candidate.name)), false);
  assert.equal(eggBlock.alternatives.some((candidate) => /tofu|chicken/i.test(candidate.name)), true);
});

test("Chicken alternatives include beef or tofu families and exclude chicken", async () => {
  const result = await buildItemAlternatives({
    item: {
      id: 10,
      name: "Chicken breast",
      calories: 165,
      protein: 31,
      carbs: 0,
      fats: 4,
      weightGrams: 100,
      category: "lunch",
      dietType: "balanced",
    },
    category: "lunch",
    mealTotals: { calories: 600, protein: 45, carbs: 40, fats: 20 },
    dayTotals: { calories: 1800, protein: 120, carbs: 150, fats: 60 },
    foods: [
      { id: 11, name: "Beef strips", calories: 170, protein: 28, carbs: 0, fats: 5, weightGrams: 100, category: "lunch", dietType: "balanced" },
      { id: 12, name: "Tofu", calories: 144, protein: 17, carbs: 3, fats: 8, weightGrams: 100, category: "lunch", dietType: "balanced" },
      { id: 13, name: "Chicken thigh", calories: 177, protein: 24, carbs: 0, fats: 8, weightGrams: 100, category: "lunch", dietType: "balanced" },
    ],
    limit: 5,
  });

  const chickenBlock = result.components.find((component) => component.replaceableComponent === "chicken");
  assert.ok(chickenBlock);
  assert.equal(chickenBlock.alternatives.some((candidate) => /beef|tofu/i.test(candidate.name)), true);
  assert.equal(chickenBlock.alternatives.some((candidate) => /chicken/i.test(candidate.name)), false);
});

test("Rice alternatives include oats or quinoa and exclude rice", () => {
  const originalItem = normalizeUsdaFood({
    id: 21,
    name: "White Rice",
    calories: 200,
    protein: 4,
    carbs: 44,
    fats: 0.4,
    weightGrams: 100,
    category: "lunch",
    dietType: "balanced",
  });

  const candidates = filterCandidates([
    normalizeUsdaFood({ id: 22, name: "Quinoa Bowl", calories: 210, protein: 8, carbs: 39, fats: 3, weightGrams: 100, category: "lunch", dietType: "balanced" }),
    normalizeUsdaFood({ id: 23, name: "Oats Savory Bowl", calories: 190, protein: 7, carbs: 33, fats: 4, weightGrams: 100, category: "lunch", dietType: "balanced" }),
    normalizeUsdaFood({ id: 24, name: "Brown Rice", calories: 205, protein: 5, carbs: 43, fats: 1, weightGrams: 100, category: "lunch", dietType: "balanced" }),
  ], "rice");

  const alternatives = getValidAlternatives(candidates, "rice", originalItem);

  assert.equal(alternatives.some((candidate) => /quinoa|oats/i.test(candidate.name)), true);
  assert.equal(alternatives.some((candidate) => /rice/i.test(candidate.name)), false);
});

test("Foods with macro calorie mismatch are marked invalid", () => {
  const normalized = normalizeUsdaFood({
    id: 20,
    name: "Egg whole",
    calories: 513,
    protein: 6,
    carbs: 1,
    fats: 5,
    weightGrams: 100,
    category: "breakfast",
    dietType: "balanced",
  });

  assert.equal(normalized.nutritionStatus, "invalid");
  assert.equal(normalized.isMealSafe, false);
});

test("Component engine extracts replaceable egg component", () => {
  const components = extractComponents("Bagels, egg");
  assert.equal(components.includes("egg"), true);
});

test("Items without replaceable components still get whole-item alternatives", async () => {
  const result = await buildItemAlternatives({
    item: normalizeUsdaFood({
      id: 31,
      name: "Simple Breakfast Bowl",
      calories: 300,
      protein: 20,
      carbs: 30,
      fats: 10,
      weightGrams: 100,
      category: "breakfast",
      dietType: "balanced",
    }),
    category: "breakfast",
    mealTotals: { calories: 300, protein: 20, carbs: 30, fats: 10 },
    dayTotals: { calories: 900, protein: 60, carbs: 90, fats: 30 },
    foods: [
      { id: 32, name: "Balanced Breakfast A", calories: 305, protein: 21, carbs: 31, fats: 9, weightGrams: 100, category: "breakfast", dietType: "balanced" },
      { id: 33, name: "Balanced Breakfast B", calories: 295, protein: 19, carbs: 29, fats: 11, weightGrams: 100, category: "breakfast", dietType: "balanced" },
      { id: 34, name: "Off Macro Breakfast", calories: 500, protein: 5, carbs: 80, fats: 10, weightGrams: 100, category: "breakfast", dietType: "balanced" },
    ],
    limit: 3,
  });

  assert.equal(Array.isArray(result.itemAlternatives), true);
  assert.equal(result.itemAlternatives.length > 0, true);
  assert.equal(result.components.length, 1);
  assert.equal(result.components[0].replaceableComponent, null);
  assert.equal(result.components[0].alternatives.length > 0, true);
  assert.equal(result.components[0].alternatives[0].name.includes("Balanced Breakfast"), true);
  assert.equal(result.components[0].alternatives.some((candidate) => /Off Macro/.test(candidate.name)), false);
});
