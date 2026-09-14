const router = require('express').Router();
const ctrl = require('./controller');
const { authenticate } = require('../../middleware/auth');
const validate = require('../../middleware/validator');
const { loginSchema } = require('./validation');
const rateLimit = require('express-rate-limit');

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'development' ? 1000 : 10,
  validate: { xForwardedForHeader: false },
  message: { success: false, message: 'Too many login attempts. Try again in 15 minutes.' },
});

const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'development' ? 1000 : 20,
  validate: { xForwardedForHeader: false },
  message: { success: false, message: 'Too many token refresh attempts. Try again later.' },
});

router.post('/login', authLimiter, validate(loginSchema), ctrl.login);
router.post('/refresh-token', refreshLimiter, ctrl.refresh);
router.post('/logout', authenticate, ctrl.logout);
router.get('/me', authenticate, ctrl.me);

module.exports = router;
