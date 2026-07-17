const REQUIRED = [
  'DATABASE_URL',
  'REDIS_URL',
  'JWT_SECRET',
  'JWT_REFRESH_SECRET',
  'CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET',
  'MTN_MOMO_SUBSCRIPTION_KEY',
  'MTN_MOMO_API_USER',
  'MTN_MOMO_API_KEY',
  'MTN_MOMO_CALLBACK_URL',
  'MOMO_CALLBACK_SECRET',
  'AFRICAS_TALKING_API_KEY',
  'AFRICAS_TALKING_USERNAME',
  'ENCRYPTION_KEY',
  'CRON_SECRET',
];

function validateEnv() {
  const missing = REQUIRED.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    console.error('[STARTUP] Missing required environment variables:', missing.join(', '));
    process.exit(1);
  }

  if (!/^[0-9a-fA-F]{64}$/.test(process.env.ENCRYPTION_KEY)) {
    console.error('[STARTUP] ENCRYPTION_KEY must be 64 hex characters. Generate one with:\n  node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
    process.exit(1);
  }

  if (process.env.JWT_SECRET.length < 32) {
    console.error('[STARTUP] JWT_SECRET must be at least 32 characters');
    process.exit(1);
  }

  if (process.env.JWT_REFRESH_SECRET.length < 32) {
    console.error('[STARTUP] JWT_REFRESH_SECRET must be at least 32 characters');
    process.exit(1);
  }

  if (!process.env.SENTRY_DSN && process.env.NODE_ENV === 'production') {
    console.warn('[STARTUP] SENTRY_DSN is not set — errors will not be captured in production');
  }
}

module.exports = { validateEnv };
