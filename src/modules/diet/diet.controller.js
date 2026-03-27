const dietService = require('./diet.service');

const calculateDiet = async (req, res, next) => {
  try {
    const result = dietService.calculateDiet(req.body);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

module.exports = { calculateDiet };
