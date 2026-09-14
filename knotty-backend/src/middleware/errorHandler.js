function errorHandler(err, req, res, next) {
  console.error(`[${new Date().toISOString()}] ${err.stack || err.message}`);

  if (err.name === 'ValidationError') {
    return res.status(400).json({ success: false, message: err.message, details: err.details });
  }

  if (err.code === 'P2025') {
    return res.status(404).json({ success: false, message: 'Record not found' });
  }

  if (err.code === 'P2002') {
    return res.status(409).json({ success: false, message: 'Duplicate entry — record already exists' });
  }

  if (err.code === 'P1001' || err.code === 'ECONNREFUSED' || err.message?.includes('DatabaseNotReachable') || err.message?.includes("Can't reach database server") || err.message?.includes('ECONNREFUSED')) {
    return res.status(503).json({ success: false, message: 'Database connection failed. Please ensure PostgreSQL is running.' });
  }

  const status = err.status || err.statusCode || 500;
  const message = status < 500 ? err.message : (process.env.NODE_ENV === 'development' ? (err.message || 'Internal server error') : 'Internal server error');
  res.status(status).json({ success: false, message });
}

module.exports = errorHandler;
