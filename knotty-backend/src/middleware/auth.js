const jwt = require('jsonwebtoken');
const prisma = require('../config/database');
const redis = require('../config/redis');

async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (!payload.sid) return res.status(401).json({ success: false, message: 'Session is invalid; please sign in again' });

    let sessionUser;
    try {
      sessionUser = await redis.get(`session:${payload.sid}`);
      const revokedSession = await redis.get(`revoked-session:${payload.sid}`);
      if (!sessionUser || sessionUser !== payload.userId || revokedSession) {
        return res.status(401).json({ success: false, message: 'Session has been revoked' });
      }
    } catch {
      return res.status(503).json({ success: false, message: 'Authentication service temporarily unavailable' });
    }

    // Reject blacklisted tokens (logged-out sessions)
    if (payload.jti) {
      try {
        const revoked = await redis.get(`blacklist:${payload.jti}`);
        if (revoked) return res.status(401).json({ success: false, message: 'Token has been revoked' });
      } catch {
        return res.status(503).json({ success: false, message: 'Authentication service temporarily unavailable' });
      }
    }

    // Resolve identity and active tenant membership from the database on every
    // request. Revocation and role changes therefore take effect immediately.
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, school_id: true, role: true, is_active: true, first_name: true, last_name: true },
    });

    if (!user || !user.is_active) {
      return res.status(401).json({ success: false, message: 'User not found or deactivated' });
    }

    const activeSchoolId = payload.schoolId || user.school_id;
    const [membership, school, platformMembership] = await Promise.all([
      prisma.schoolMembership.findFirst({
        where: { user_id: user.id, school_id: activeSchoolId, status: 'ACTIVE' },
        select: { role: true },
      }),
      prisma.school.findUnique({ where: { id: activeSchoolId }, select: { id: true, organization_id: true } }),
      prisma.platformMembership.findFirst({ where: { user_id: user.id, status: 'ACTIVE' }, select: { role: true } }),
    ]);
    let effectiveRole = platformMembership?.role || membership?.role;
    if (school?.organization_id) {
      const orgMembership = await prisma.organizationMembership.findFirst({
        where: { user_id: user.id, organization_id: school.organization_id, status: 'ACTIVE' },
        select: { role: true },
      });
      if (orgMembership?.role === 'ORGANIZATION_MANAGER') effectiveRole = orgMembership.role;
    }
    if (!school || !effectiveRole) {
      return res.status(403).json({ success: false, message: 'No active membership for this school' });
    }
    req.user = { ...user, role: effectiveRole, school_id: activeSchoolId, session_id: payload.sid };
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
}

// Call this after deactivating a user so the cache doesn't serve stale data
async function invalidateUserCache(userId) {
  // Kept for compatibility with callers after moving authorization off cache.
  redis.del(`user:${userId}`).catch(() => {});
}

module.exports = { authenticate, invalidateUserCache };
