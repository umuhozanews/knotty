const rateLimit = require('express-rate-limit');

// Applied to all /api routes — blocks brute-force and scraping
const isDev = process.env.NODE_ENV === 'development';
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 10000 : 300,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
  message: { success: false, message: 'Too many requests. Please slow down and try again.' },
});

// Applied to NFC taps, purchases, top-ups — high-value operations
const transactionLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
  message: { success: false, message: 'Too many transaction requests. Please wait a moment.' },
});

module.exports = { globalLimiter, transactionLimiter };
