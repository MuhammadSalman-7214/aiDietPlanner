const axios = require("axios");

const OFF_SEARCH_URL = "https://world.openfoodfacts.org/cgi/search.pl";
const OFF_RATE_LIMIT_DELAY_MS = 600;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const normalizeOffProduct = (product = {}, query = "") => {
  const nutriments = product.nutriments || {};
  const calories = Number(nutriments["energy-kcal_100g"]);

  if (!Number.isFinite(calories) || calories <= 0) return null;

  return {
    name: product.product_name || query,
    calories,
    protein: Number(nutriments["proteins_100g"] ?? 0),
    carbs: Number(nutriments["carbohydrates_100g"] ?? 0),
    fats: Number(nutriments["fat_100g"] ?? 0),
    weightGrams: 100,
    source: "open_food_facts",
  };
};

async function fetchOFFfoods(query) {
  const response = await axios.get(OFF_SEARCH_URL, {
    params: {
      search_terms: query,
      search_simple: 1,
      action: "process",
      json: 1,
      page_size: 20,
    },
    timeout: 15000,
  });

  const products = response.data?.products || [];
  return products
    .map((product) => normalizeOffProduct(product, query))
    .filter(Boolean);
}

async function searchAndTransform(query) {
  return fetchOFFfoods(query);
}

module.exports = {
  OFF_RATE_LIMIT_DELAY_MS,
  fetchOFFfoods,
  searchAndTransform,
  sleep,
};
