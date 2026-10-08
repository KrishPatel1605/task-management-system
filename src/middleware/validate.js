const AppError = require('../utils/AppError');

/** validate(schema, 'body' | 'params' | 'query') - replaces the source with the parsed (cleaned) value. */
module.exports = (schema, source = 'body') => (req, res, next) => {
  const result = schema.safeParse(req[source]);
  if (!result.success) {
    const details = result.error.issues.map((i) => ({ field: i.path.join('.') || source, message: i.message }));
    return next(new AppError(400, 'Validation failed', details));
  }
  // req.query is a getter in newer Express versions, so store parsed data separately
  req.valid = { ...(req.valid || {}), [source]: result.data };
  next();
};
