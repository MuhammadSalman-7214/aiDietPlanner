const { REPLACEMENTS } = require("./replacement.map");

const normalize = (text) =>
  String(text || "")
    .toLowerCase()
    .replace(/[^a-z\s]/g, "")
    .trim();

const COMPONENT_MAP = {
  egg: ["egg", "eggs", "egg white", "egg yolk", "omelette", "omelet"],
  chicken: ["chicken", "chicken breast", "chicken thigh", "chicken skin"],
  turkey: ["turkey", "turkey breast"],
  beef: ["beef", "steak", "burger", "meatballs"],
  tofu: ["tofu", "tempeh"],
  beans: ["bean", "beans", "chickpea", "chickpeas", "lentil", "lentils"],
  rice: ["rice", "white rice", "brown rice", "basmati rice", "jasmine rice"],
  quinoa: ["quinoa"],
  oats: ["oat", "oats", "oatmeal", "porridge"],
  bread: ["bread", "bagel", "bagels", "bun", "toast", "wrap"],
  wrap: ["wrap", "tortilla"],
  potato: ["potato", "potatoes", "sweet potato"],
  fish: ["fish", "salmon", "tuna", "cod", "tilapia"],
  dairy: ["milk", "yogurt", "cheese", "cottage cheese", "kefir"],
  nuts: ["nuts", "almond", "almonds", "walnut", "walnuts", "peanut", "peanuts"],
  avocado: ["avocado"],
  vegetable: [
    "vegetable",
    "vegetables",
    "broccoli",
    "spinach",
    "zucchini",
    "cauliflower",
    "salad",
  ],
};

const PROTEIN_COMPONENTS = new Set(["egg", "chicken", "turkey", "beef", "tofu", "beans"]);
const CARB_COMPONENTS = new Set(["rice", "quinoa", "oats", "bread", "wrap", "potato"]);

const getComponentVariants = (component) => COMPONENT_MAP[component] || [component];

const extractComponents = (foodName) => {
  const normalized = normalize(foodName);
  if (!normalized) return [];

  const found = [];

  for (const key of Object.keys(COMPONENT_MAP)) {
    const variants = COMPONENT_MAP[key];
    if (variants.some((variant) => normalized.includes(normalize(variant)))) {
      found.push(key);
    }
  }

  return [...new Set(found)];
};

const hasReplacementRule = (component) =>
  Array.isArray(REPLACEMENTS[component]) && REPLACEMENTS[component].length > 0;

const selectReplaceableComponents = (components = [], explicitTargets = []) => {
  const normalizedTargets = explicitTargets
    .map((item) => normalize(item))
    .filter(Boolean);

  if (normalizedTargets.length > 0) {
    const matchedComponents = components.filter((component) => normalizedTargets.includes(normalize(component)));
    if (matchedComponents.length > 0) return matchedComponents;

    return normalizedTargets.filter((component) => hasReplacementRule(component));
  }

  const replaceable = components.filter((component) => hasReplacementRule(component));
  const proteins = replaceable.filter((component) => PROTEIN_COMPONENTS.has(component));
  if (proteins.length > 0) return proteins;

  const carbs = replaceable.filter((component) => CARB_COMPONENTS.has(component));
  if (carbs.length > 0) return carbs;

  return replaceable;
};

module.exports = {
  COMPONENT_MAP,
  extractComponents,
  getComponentVariants,
  normalize,
  selectReplaceableComponents,
};
