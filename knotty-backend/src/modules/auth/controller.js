const authService = require('./service');
const prisma = require('../../config/database');

async function login(req, res, next) {
  process.stdout.write('[AUTH] login attempt\n');
  try {
    const result = await authService.login(req.body.email, req.body.password);
    process.stdout.write('[AUTH] login success\n');
    res.json({ success: true, ...result });
  } catch (err) {
    process.stderr.write('[AUTH LOGIN ERROR] ' + (err.stack || err.message) + '\n');
    next(err);
  }
}

async function refresh(req, res, next) {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(400).json({ success: false, message: 'Refresh token required' });
    const tokens = await authService.refreshTokens(refreshToken);
    res.json({ success: true, ...tokens });
  } catch (err) {
    next(err);
  }
}

async function logout(req, res, next) {
  try {
    await authService.logout(req.user.id);
    res.json({ success: true, message: 'Logged out' });
  } catch (err) {
    next(err);
  }
}

async function me(req, res, next) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true, role: true, school_id: true,
        first_name: true, last_name: true, email: true,
        phone: true, profile_photo: true, last_login: true,
      },
    });
    res.json({ success: true, user });
  } catch (err) {
    next(err);
  }
}

module.exports = { login, refresh, logout, me };
