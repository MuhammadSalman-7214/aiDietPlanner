const axios = require("axios");
require("dotenv").config();

const USDA_BASE_URL = "https://api.nal.usda.gov/fdc/v1/foods/search";

const fetchFoodsFromUSDA = async (query = "chicken", pageSize = 20) => {
  try {
    const response = await axios.get(USDA_BASE_URL, {
      params: {
        api_key: process.env.USDA_API_KEY,
        query,
        pageSize,
      },
    });

    return response.data.foods;
  } catch (error) {
    console.error("USDA API Error:", error.message);
    return [];
  }
};

module.exports = { fetchFoodsFromUSDA };
