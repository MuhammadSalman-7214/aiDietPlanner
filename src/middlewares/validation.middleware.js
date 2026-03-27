const { AppError } = require('./error.middleware');

const validateRequest = (schema) => (req, res, next) => {
  const { error, value } = schema.validate(req.body, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    return next(new AppError('Validation failed', 400, error.details));
  }

  req.body = value;
  return next();
};

module.exports = { validateRequest };
