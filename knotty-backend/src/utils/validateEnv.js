// Hard-required: server cannot function without these
const REQUIRED = [
  'DATABASE_URL',
  'REDIS_URL',
  'JWT_SECRET',
  'JWT_REFRESH_SECRET',
  'ENCRYPTION_KEY',
  'BACKUP_CRON_SECRET',
  'MOMO_CALLBACK_SECRET',
];

// Soft-required: integrations degrade gracefully but should be set in production
const RECOMMENDED = [
  'CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET',
  'MTN_MOMO_SUBSCRIPTION_KEY',
  'MTN_MOMO_API_USER',
  'MTN_MOMO_API_KEY',
  'MTN_MOMO_CALLBACK_URL',
  'AFRICAS_TALKING_API_KEY',
  'AFRICAS_TALKING_USERNAME',
];

function validateEnv() {
  const missing = REQUIRED.filter((k) => !process.env[k]);
  if (missing.length > 0 && process.env.NODE_ENV !== 'production') {
    console.warn('[STARTUP] Missing required environment variables:', missing.join(', '));
  }

  const missingRecommended = RECOMMENDED.filter((k) => !process.env[k]);
  if (missingRecommended.length > 0) {
    console.warn('[STARTUP] Missing recommended environment variables (some features will be disabled):', missingRecommended.join(', '));
  }

  const encKey = process.env.ENCRYPTION_KEY || '';
  if (encKey && !/^[0-9a-fA-F]{64}$/.test(encKey)) {
    console.warn('[STARTUP] ENCRYPTION_KEY must be 64 hex characters');
  }

  const jwtSec = process.env.JWT_SECRET || '';
  if (jwtSec && jwtSec.length < 32) {
    console.warn('[STARTUP] JWT_SECRET must be at least 32 characters');
  }

  const jwtRefSec = process.env.JWT_REFRESH_SECRET || '';
  if (jwtRefSec && jwtRefSec.length < 32) {
    console.warn('[STARTUP] JWT_REFRESH_SECRET must be at least 32 characters');
  }

  if (!process.env.SENTRY_DSN && process.env.NODE_ENV === 'production') {
    console.warn('[STARTUP] SENTRY_DSN is not set — errors will not be captured in production');
  }
}

module.exports = { validateEnv };
