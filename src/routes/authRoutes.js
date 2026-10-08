const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const asyncHandler = require('../utils/asyncHandler');
const validate = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const schemas = require('../validators/schemas');
const ctrl = require('../controllers/authController');

// Basic brute-force protection on credential endpoints.
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: process.env.NODE_ENV === 'test' ? 10000 : 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many attempts, please try again later' },
});

router.post('/register', limiter, validate(schemas.register), asyncHandler(ctrl.register));
router.post('/login', limiter, validate(schemas.login), asyncHandler(ctrl.login));
router.get('/me', asyncHandler(authenticate), ctrl.me);

module.exports = router;
