require('dotenv').config();
process.on('uncaughtException', (e) => process.stderr.write('[UNCAUGHT] ' + e.stack + '\n'));
process.on('unhandledRejection', (e) => process.stderr.write('[UNHANDLED] ' + e + '\n'));
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const errorHandler = require('./middleware/errorHandler');

const path = require('path');
const app = express();

// ─── Security & Parsing ───
app.use(helmet());
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

// ─── Static uploads (local dev fallback) ───
app.use('/uploads', express.static(path.join(__dirname, '../../uploads')));

// ─── Health check ───
app.get('/health', (req, res) => res.json({ status: 'ok', service: 'KNOTTY Backend', timestamp: new Date() }));

// ─── 404 ───
app.use((req, res) => res.status(404).json({ success: false, message: `Route ${req.path} not found` }));

// ─── Error Handler ───
app.use(errorHandler);

if (!process.env.VERCEL) {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`KNOTTY Backend running on port ${PORT} [${process.env.NODE_ENV}]`);
  });
}

module.exports = app;
