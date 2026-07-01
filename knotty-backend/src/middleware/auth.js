const jwt = require('jsonwebtoken');
const prisma = require('../config/database');
const redis = require('../config/redis');

const USER_TTL = 900; // 15 minutes — matches JWT lifetime

async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const cacheKey = `user:${payload.userId}`;

    // Try cache first — avoids a DB hit on every request
    let user = null;
    try {
      const cached = await redis.get(cacheKey);
      if (cached) user = JSON.parse(cached);
    } catch (_) { /* cache miss is fine */ }

    if (!user) {
      user = await prisma.user.findUnique({
        where: { id: payload.userId },
        select: { id: true, school_id: true, role: true, is_active: true, first_name: true, last_name: true },
      });
      if (user) {
        redis.set(cacheKey, JSON.stringify(user), 'EX', USER_TTL).catch(() => {});
      }
    }

    if (!user || !user.is_active) {
      return res.status(401).json({ success: false, message: 'User not found or deactivated' });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
}

// Call this after deactivating a user so the cache doesn't serve stale data
async function invalidateUserCache(userId) {
  redis.del(`user:${userId}`).catch(() => {});
}

module.exports = { authenticate, invalidateUserCache };
