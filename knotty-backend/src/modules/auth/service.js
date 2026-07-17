const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const prisma = require('../../config/database');

let redis = null;
try {
  redis = require('../../config/redis');
} catch {
  // Redis unavailable — lockout and token revocation disabled, refresh tokens still work via JWT
}

async function redisSet(key, value, ttl) {
  if (!redis) return;
  try { await redis.set(key, value, 'EX', ttl); } catch { /* no-op */ }
}

const REDIS_ERROR = '__redis_error__';
async function redisGet(key) {
  if (!redis) return REDIS_ERROR;
  try { return await redis.get(key); } catch { return REDIS_ERROR; }
}

async function redisIncr(key, ttl) {
  if (!redis) return 0;
  try {
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, ttl); // set TTL only on first increment
    return count;
  } catch { return 0; }
}

async function redisDel(key) {
  if (!redis) return;
  try { await redis.del(key); } catch { /* no-op */ }
}

const LOCKOUT_MAX_ATTEMPTS = 5;
const LOCKOUT_WINDOW_SECS = 15 * 60; // 15 minutes

function generateTokens(userId, role, schoolId) {
  const jti = crypto.randomUUID(); // unique ID per access token — used for blacklisting
  const payload = { userId, role, schoolId, jti };
  const accessToken = jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
  });
  const refreshToken = jwt.sign({ userId, role, schoolId }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  });
  return { accessToken, refreshToken };
}

async function login(email, password) {
  const cleanEmail = String(email || '').trim().toLowerCase();
  const lockKey = `lockout:${cleanEmail}`;

  // Check account lockout before hitting the DB
  const attempts = await redisGet(lockKey);
  if (attempts !== REDIS_ERROR && Number(attempts) >= LOCKOUT_MAX_ATTEMPTS) {
    throw Object.assign(
      new Error('Account temporarily locked due to too many failed attempts. Try again in 15 minutes.'),
      { status: 429 }
    );
  }

  const user = await prisma.user.findUnique({ where: { email: cleanEmail } });

  if (!user || !user.is_active) {
    // Increment lockout counter even for unknown emails — prevents user enumeration
    await redisIncr(lockKey, LOCKOUT_WINDOW_SECS);
    throw Object.assign(new Error('Invalid credentials'), { status: 401 });
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    await redisIncr(lockKey, LOCKOUT_WINDOW_SECS);
    const remaining = LOCKOUT_MAX_ATTEMPTS - (Number(attempts) + 1);
    const msg = remaining > 0
      ? `Invalid credentials. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining before lockout.`
      : 'Invalid credentials. Account is now locked for 15 minutes.';
    throw Object.assign(new Error(msg), { status: 401 });
  }

  // Successful login — clear lockout counter
  await redisDel(lockKey);
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

  const stored = await redisGet(`refresh:${payload.userId}`);
  if (stored === REDIS_ERROR) {
    throw Object.assign(new Error('Service temporarily unavailable, please try again'), { status: 503 });
  }
  if (stored !== null && stored !== token) {
    throw Object.assign(new Error('Refresh token revoked'), { status: 401 });
  }

  const { accessToken, refreshToken } = generateTokens(payload.userId, payload.role, payload.schoolId);
  await redisSet(`refresh:${payload.userId}`, refreshToken, 7 * 24 * 3600);

  return { accessToken, refreshToken };
}

async function logout(userId, accessToken) {
  await redisDel(`refresh:${userId}`);

  // Blacklist the access token so it can't be used even within its remaining 15-min window
  if (accessToken) {
    try {
      const payload = jwt.decode(accessToken);
      if (payload?.jti && payload?.exp) {
        const ttl = payload.exp - Math.floor(Date.now() / 1000);
        if (ttl > 0) await redisSet(`blacklist:${payload.jti}`, '1', ttl);
      }
    } catch { /* no-op */ }
  }
}

module.exports = { login, refreshTokens, logout };
