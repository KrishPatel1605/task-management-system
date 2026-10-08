const jwt = require('jsonwebtoken');
const config = require('../config');
const db = require('../db');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

/** Verifies the Bearer token and loads the current user (so deleted users / role changes take effect immediately). */
exports.authenticate = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) throw new AppError(401, 'Authentication required');

  let payload;
  try {
    payload = jwt.verify(token, config.jwt.secret, { algorithms: ['HS256'] });
  } catch (err) {
    throw new AppError(401, err.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token');
  }

  const user = await db('users').select('id', 'name', 'email', 'role').where({ id: payload.sub }).first();
  if (!user) throw new AppError(401, 'User no longer exists');

  req.user = user;
  next();
});

/** Role guard: authorize('admin') */
exports.authorize = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return next(new AppError(403, 'You do not have permission to perform this action'));
  }
  next();
};
