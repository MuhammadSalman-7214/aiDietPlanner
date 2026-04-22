const Joi = require('joi');

const mealItemReplacementSchema = Joi.object({
  mealType: Joi.string().valid('breakfast', 'lunch', 'dinner', 'snack').optional(),
  itemId: Joi.number().integer().positive().optional(),
  itemName: Joi.string().trim().min(1).max(255).optional(),
  targetComponent: Joi.alternatives().try(
    Joi.string().trim().min(1).max(255),
    Joi.array().items(Joi.string().trim().min(1).max(255)).min(1),
  ).optional(),
  limit: Joi.number().integer().min(1).max(10).default(4),
})
  .or('itemId', 'itemName')
  .optional();

module.exports = {
  mealItemReplacementSchema,
};
