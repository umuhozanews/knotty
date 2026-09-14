require('dotenv').config();

const { validateEnv } = require('./utils/validateEnv');
validateEnv();

// Sentry must be initialized before any other requires
const Sentry = require('@sentry/node');
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 0,
  });
}

process.on('uncaughtException', (e) => {
  Sentry.captureException(e);
  process.stderr.write('[UNCAUGHT] ' + e.stack + '\n');
});
process.on('unhandledRejection', (e) => {
  Sentry.captureException(e);
  process.stderr.write('[UNHANDLED] ' + e + '\n');
});

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const errorHandler = require('./middleware/errorHandler');
const { globalLimiter } = require('./middleware/rateLimiter');
const { waf } = require('./middleware/waf');

const path = require('path');
const app = express();

// ─── Security & Parsing ───
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https://res.cloudinary.com'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
}));
app.use(globalLimiter);
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:3000')
  .split(',').map(o => o.trim());
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.some(o => origin === o)) return cb(null, true);
    cb(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
// WAF runs after body parsing so req.body is populated
app.use(waf);

// ─── Routes ───
const API = '/api/v1';

app.use(`${API}/auth`, require('./modules/auth/routes'));
app.use(`${API}/schools`, require('./modules/schools/routes'));
app.use(`${API}/students`, require('./modules/students/routes'));
app.use(`${API}/cards`, require('./modules/cards/routes'));
app.use(`${API}/attendance`, require('./modules/attendance/routes'));
app.use(`${API}/fees`, require('./modules/fees/routes'));
app.use(`${API}/canteen`, require('./modules/canteen/routes'));
app.use(`${API}/health`, require('./modules/health/routes'));
app.use(`${API}/discipline`, require('./modules/discipline/routes'));
app.use(`${API}/achievements`, require('./modules/achievements/routes'));
app.use(`${API}/reports`, require('./modules/reports/routes'));
app.use(`${API}/teachers`, require('./modules/teachers/routes'));
app.use(`${API}/structure`, require('./modules/levels/routes'));
app.use(`${API}/notifications`, require('./modules/notifications/routes'));
app.use(`${API}/materials`, require('./modules/materials/routes'));
app.use(`${API}/library`, require('./modules/library/routes'));
app.use(`${API}/gate-access`, require('./modules/gate-access/routes'));
app.use(`${API}/academics`, require('./modules/academics/routes'));
app.use(`${API}/admin`, require('./modules/admin/routes'));

// ─── Static uploads (local dev fallback) ───
const baseDir = typeof __dirname !== 'undefined' ? __dirname : process.cwd();
app.use('/uploads', express.static(path.join(baseDir, '../../uploads')));

// ─── Health check ───
app.get('/health', async (req, res) => {
  const checks = { db: false, redis: false };
  try {
    const prisma = require('./config/database');
    await prisma.$queryRaw`SELECT 1`;
    checks.db = true;
  } catch (_) {}
  try {
    const redis = require('./config/redis');
    await redis.set('health:ping', '1', 'EX', 5);
    checks.redis = true;
  } catch (_) {}

  const allOk = checks.db && checks.redis;
  res.status(allOk ? 200 : 503).json({
    status: allOk ? 'ok' : 'degraded',
    service: 'KNOTTY Backend',
    checks,
    timestamp: new Date(),
  });
});

// ─── 404 ───
app.use((req, res) => res.status(404).json({ success: false, message: `Route ${req.path} not found` }));

// ─── Error Handler ───
if (process.env.SENTRY_DSN) app.use(Sentry.expressErrorHandler());
app.use(errorHandler);

if (require.main === module) {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`KNOTTY Backend running on port ${PORT} [${process.env.NODE_ENV}]`);
  });
}

module.exports = app;
