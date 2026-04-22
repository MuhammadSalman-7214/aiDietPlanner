const REPLACEMENTS = {
  egg: ["tofu", "chicken", "beans"],
  chicken: ["beef", "turkey", "tofu"],
  turkey: ["beef", "chicken", "tofu"],
  beef: ["chicken", "turkey", "tofu"],
  tofu: ["chicken", "beans", "beef"],
  beans: ["tofu", "chicken", "turkey"],
  rice: ["quinoa", "oats"],
  bread: ["wrap", "oats"],
  wrap: ["bread", "oats"],
  vegetable: ["beans", "lentils"],
};

module.exports = {
  REPLACEMENTS,
};
