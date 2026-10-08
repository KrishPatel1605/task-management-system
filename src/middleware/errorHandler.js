const config = require('../config');

exports.notFound = (req, res) => {
  res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.originalUrl}` });
};

// eslint-disable-next-line no-unused-vars
exports.errorHandler = (err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ success: false, message: 'Malformed JSON body' });
  }
  if (err.status) {
    return res.status(err.status).json({ success: false, message: err.message, ...(err.details && { errors: err.details }) });
  }
  console.error(err);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    ...(config.env !== 'production' && { error: err.message }),
  });
};
