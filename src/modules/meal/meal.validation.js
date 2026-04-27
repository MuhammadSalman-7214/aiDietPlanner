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

const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

const timeWindowSchema = Joi.object({
  start: Joi.string().pattern(timePattern).required(),
  end: Joi.string().pattern(timePattern).required(),
  timezone: Joi.string().trim().min(1).max(64).optional(),
});

const mealTimeWindowUpdateSchema = Joi.object({
  mealType: Joi.string().valid('breakfast', 'lunch', 'dinner', 'snack').required(),
  mealIndex: Joi.number().integer().min(1).when('mealType', {
    is: 'snack',
    then: Joi.required(),
    otherwise: Joi.forbidden(),
  }),
  start: Joi.string().pattern(timePattern).required(),
  end: Joi.string().pattern(timePattern).required(),
  timezone: Joi.string().trim().min(1).max(64).optional(),
});

const mealTimeWindowsSchema = Joi.alternatives().try(
  mealTimeWindowUpdateSchema,
  Joi.object({
    breakfast: timeWindowSchema.optional(),
    lunch: timeWindowSchema.optional(),
    dinner: timeWindowSchema.optional(),
    snacks: Joi.array().items(
      Joi.object({
        mealIndex: Joi.number().integer().min(1).required(),
        start: Joi.string().pattern(timePattern).required(),
        end: Joi.string().pattern(timePattern).required(),
        timezone: Joi.string().trim().min(1).max(64).optional(),
      }),
    ).optional(),
  }).min(1),
);

module.exports = {
  mealItemReplacementSchema,
  mealTimeWindowUpdateSchema,
  mealTimeWindowsSchema,
};
