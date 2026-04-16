const mapCategory = (name) => {
  const lower = name.toLowerCase();

  if (lower.includes("egg") || lower.includes("oat")) return "breakfast";

  if (lower.includes("rice") || lower.includes("chicken")) return "lunch";

  if (lower.includes("salad") || lower.includes("vegetable")) return "dinner";

  return "snack";
};

const transformUSDAFood = (food) => {
  const nutrients = food.foodNutrients || [];

  const getNutrient = (name) => {
    const nutrient = nutrients.find((n) =>
      n.nutrientName.toLowerCase().includes(name),
    );
    return nutrient ? nutrient.value : 0;
  };

  return {
    name: food.description,
    calories: getNutrient("energy"), // kcal
    protein: getNutrient("protein"),
    carbs: getNutrient("carbohydrate"),
    fats: getNutrient("fat"),
    category: mapCategory(food.description),
    diet_type: "balanced",
  };
};

module.exports = { transformUSDAFood };
