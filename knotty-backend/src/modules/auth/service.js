const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../../config/database');

let redis = null;
try {
  redis = require('../../config/redis');
} catch {
  // Redis unavailable — token revocation disabled, refresh tokens still work via JWT
}

async function redisSet(key, value, ttl) {
  if (!redis) return;
  try { await redis.set(key, value, 'EX', ttl); } catch { /* no-op */ }
}

async function redisGet(key) {
  if (!redis) return null;
  try { return await redis.get(key); } catch { return null; }
}

async function redisDel(key) {
  if (!redis) return;
  try { await redis.del(key); } catch { /* no-op */ }
}

function generateTokens(userId, role, schoolId) {
  const payload = { userId, role, schoolId };
  const accessToken = jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
  });
  const refreshToken = jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  });
  return { accessToken, refreshToken };
}

async function login(email, password) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.is_active) throw Object.assign(new Error('Invalid credentials'), { status: 401 });

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) throw Object.assign(new Error('Invalid credentials'), { status: 401 });

  await prisma.user.update({ where: { id: user.id }, data: { last_login: new Date() } });

  const { accessToken, refreshToken } = generateTokens(user.id, user.role, user.school_id);
  await redisSet(`refresh:${user.id}`, refreshToken, 7 * 24 * 3600);

  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      role: user.role,
      school_id: user.school_id,
      first_name: user.first_name,
      last_name: user.last_name,
      email: user.email,
      profile_photo: user.profile_photo,
    },
  };
}

async function refreshTokens(token) {
  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
  } catch {
    throw Object.assign(new Error('Invalid refresh token'), { status: 401 });
  }

  // When Redis is available, validate stored token; otherwise trust JWT signature
  const stored = await redisGet(`refresh:${payload.userId}`);
  if (stored !== null && stored !== token) {
    throw Object.assign(new Error('Refresh token revoked'), { status: 401 });
  }

  const { accessToken, refreshToken } = generateTokens(payload.userId, payload.role, payload.schoolId);
  await redisSet(`refresh:${payload.userId}`, refreshToken, 7 * 24 * 3600);

  return { accessToken, refreshToken };
}

async function logout(userId) {
  await redisDel(`refresh:${userId}`);
}

module.exports = { login, refreshTokens, logout };
