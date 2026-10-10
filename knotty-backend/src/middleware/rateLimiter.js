const rateLimit = require('express-rate-limit');

// Applied to all /api routes — blocks brute-force and scraping while allowing high-throughput school gate & POS traffic
const isDev = process.env.NODE_ENV === 'development';

const isHighVolumeTransaction = (req) => {
  const p = req.path || '';
  return p.includes('/attendance/scan') || p.includes('/canteen/purchase');
};

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 10000 : 5000,
  skip: isHighVolumeTransaction,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
  message: { success: false, message: 'Too many requests. Please slow down and try again.' },
});

// Applied to NFC taps, purchases, top-ups
const transactionLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
  message: { success: false, message: 'Too many transaction requests. Please wait a moment.' },
});

module.exports = { globalLimiter, transactionLimiter };
