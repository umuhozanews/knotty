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
  if (!redis) return false;
  try { await redis.set(key, value, 'EX', ttl); return true; } catch { return false; }
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
  if (!redis) return false;
  try { await redis.del(key); return true; } catch { return false; }
}

const LOCKOUT_MAX_ATTEMPTS = process.env.NODE_ENV === 'production' ? 10 : 100;
const LOCKOUT_WINDOW_SECS = 15 * 60; // 15 minutes

function generateTokens(userId, role, schoolId, sessionId = crypto.randomUUID()) {
  const jti = crypto.randomUUID(); // unique ID per access token — used for blacklisting
  const payload = { userId, role, schoolId, sid: sessionId, jti };
  const accessToken = jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
  });
  const refreshToken = jwt.sign({ userId, role, schoolId, sid: sessionId }, process.env.JWT_REFRESH_SECRET, {
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

  let user = await prisma.user.findUnique({ where: { email: cleanEmail } });
  if (!user) {
    // Check legacy / rebranded domain variations for seamless login
    if (cleanEmail.includes('@ishurihub.rw')) {
      const alt1 = cleanEmail.replace('@ishurihub.rw', '@knottyschool.rw');
      const alt2 = cleanEmail.replace('@ishurihub.rw', '@knotty.rw');
      user = await prisma.user.findFirst({ where: { email: { in: [alt1, alt2] } } });
    } else if (cleanEmail.includes('@knottyschool.rw') || cleanEmail.includes('@knotty.rw')) {
      const alt = cleanEmail.replace('@knottyschool.rw', '@ishurihub.rw').replace('@knotty.rw', '@ishurihub.rw');
      user = await prisma.user.findUnique({ where: { email: alt } });
    }
  }

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

  // Successful login — clear lockout counter (for cleanEmail and user.email)
  await redisDel(lockKey);
  if (user.email && user.email !== cleanEmail) {
    await redisDel(`lockout:${user.email.toLowerCase()}`);
  }
  await prisma.user.update({ where: { id: user.id }, data: { last_login: new Date() } });

  const [membership, schoolContext, platformMembership] = await Promise.all([prisma.schoolMembership.findFirst({
    where: { user_id: user.id, school_id: user.school_id, status: 'ACTIVE' },
    select: { role: true },
  }), prisma.school.findUnique({ where: { id: user.school_id }, select: { organization_id: true } }),
  prisma.platformMembership.findFirst({ where: { user_id: user.id, status: 'ACTIVE' }, select: { role: true } })]);
  const orgMembership = schoolContext?.organization_id ? await prisma.organizationMembership.findFirst({
    where: { user_id: user.id, organization_id: schoolContext.organization_id, status: 'ACTIVE' }, select: { role: true },
  }) : null;
  const activeRole = platformMembership?.role || (
    orgMembership?.role === 'ORGANIZATION_MANAGER' ? orgMembership.role : membership?.role
  );
  if (!activeRole) {
    throw Object.assign(new Error('Account has no active school membership. Contact your school administrator.'), { status: 403 });
  }
  const sessionId = crypto.randomUUID();
  const { accessToken, refreshToken } = generateTokens(user.id, activeRole, user.school_id, sessionId);
  const sessionStored = await redisSet(`session:${sessionId}`, user.id, 7 * 24 * 3600);
  const refreshStored = await redisSet(`refresh:${sessionId}`, refreshToken, 7 * 24 * 3600);
  if (!sessionStored || !refreshStored) throw Object.assign(new Error('Authentication service temporarily unavailable'), { status: 503 });

  const [fullUser, memberships] = await Promise.all([
    getUserFullProfile(user.id),
    prisma.school.findMany({
      where: platformMembership ? {} : {
        OR: [
          { memberships: { some: { user_id: user.id, status: 'ACTIVE' } } },
          ...(orgMembership?.role === 'ORGANIZATION_MANAGER'
            ? [{ organization_id: schoolContext.organization_id }] : []),
        ],
      },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, code: true, organization_id: true,
        memberships: { where: { user_id: user.id, status: 'ACTIVE' }, select: { role: true } } },
    }),
  ]);
  fullUser.role = activeRole;
  fullUser.available_schools = memberships.map((school) => ({
    id: school.id, name: school.name, code: school.code,
    role: platformMembership?.role || (school.organization_id === schoolContext?.organization_id &&
      orgMembership?.role === 'ORGANIZATION_MANAGER'
      ? orgMembership.role : school.memberships[0]?.role || null),
  }));

  return {
    accessToken,
    refreshToken,
    user: fullUser,
  };
}

async function refreshTokens(token) {
  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
  } catch {
    throw Object.assign(new Error('Invalid refresh token'), { status: 401 });
  }

  if (!payload.sid) throw Object.assign(new Error('Refresh session is invalid'), { status: 401 });
  const [stored, sessionUser, revoked] = await Promise.all([
    redisGet(`refresh:${payload.sid}`), redisGet(`session:${payload.sid}`), redisGet(`revoked-session:${payload.sid}`),
  ]);
  if (sessionUser === REDIS_ERROR || revoked === REDIS_ERROR) throw Object.assign(new Error('Service temporarily unavailable, please try again'), { status: 503 });
  if (!sessionUser || sessionUser !== payload.userId || revoked) throw Object.assign(new Error('Session revoked'), { status: 401 });
  if (stored === REDIS_ERROR) {
    throw Object.assign(new Error('Service temporarily unavailable, please try again'), { status: 503 });
  }
  if (stored !== token) {
    throw Object.assign(new Error('Refresh token revoked'), { status: 401 });
  }

  const [membership, school, platformMembership] = await Promise.all([prisma.schoolMembership.findFirst({
    where: { user_id: payload.userId, school_id: payload.schoolId, status: 'ACTIVE' },
    select: { role: true },
  }), prisma.school.findUnique({ where: { id: payload.schoolId }, select: { organization_id: true } }),
  prisma.platformMembership.findFirst({ where: { user_id: payload.userId, status: 'ACTIVE' }, select: { role: true } })]);
  const orgMembership = school?.organization_id ? await prisma.organizationMembership.findFirst({
    where: { user_id: payload.userId, organization_id: school.organization_id, status: 'ACTIVE' }, select: { role: true },
  }) : null;
  const activeRole = platformMembership?.role || (
    orgMembership?.role === 'ORGANIZATION_MANAGER' ? orgMembership.role : membership?.role
  );
  if (!activeRole) throw Object.assign(new Error('School membership is no longer active'), { status: 401 });
  const { accessToken, refreshToken } = generateTokens(payload.userId, activeRole, payload.schoolId, payload.sid);
  const refreshStored = await redisSet(`refresh:${payload.sid}`, refreshToken, 7 * 24 * 3600);
  const sessionStored = await redisSet(`session:${payload.sid}`, payload.userId, 7 * 24 * 3600);
  if (!refreshStored || !sessionStored) throw Object.assign(new Error('Authentication service temporarily unavailable'), { status: 503 });

  return { accessToken, refreshToken };
}

async function logout(userId, accessToken) {
  const payload = accessToken ? jwt.decode(accessToken) : null;
  if (!payload?.sid || payload.userId !== userId) throw Object.assign(new Error('Invalid session'), { status: 401 });
  const revoked = await redisSet(`revoked-session:${payload.sid}`, '1', 7 * 24 * 3600);
  if (!revoked) throw Object.assign(new Error('Authentication service temporarily unavailable'), { status: 503 });
  await Promise.all([redisDel(`refresh:${payload.sid}`), redisDel(`session:${payload.sid}`)]);
}

async function getUserFullProfile(userId) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      role: true,
      school_id: true,
      first_name: true,
      last_name: true,
      email: true,
      phone: true,
      profile_photo: true,
      last_login: true,
      created_at: true,
      school: {
        select: {
          id: true,
          name: true,
          code: true,
          logo: true,
          email: true,
          phone: true,
          address: true,
          subscription_plan: true,
        },
      },
      student: {
        select: {
          id: true,
          student_code: true,
          gender: true,
          date_of_birth: true,
          nationality: true,
          enrollment_date: true,
          class: {
            select: {
              id: true,
              name: true,
              academic_year: true,
            },
          },
          level: {
            select: {
              id: true,
              name: true,
            },
          },
          card: {
            select: {
              id: true,
              card_number: true,
              nfc_uid: true,
              qr_code: true,
              wallet_balance: true,
              daily_limit: true,
              is_active: true,
              is_frozen: true,
              expires_at: true,
            },
          },
          parent: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              phone: true,
              email: true,
            },
          },
        },
      },
      teacher: {
        select: {
          id: true,
          employee_code: true,
          qualification: true,
          specialization: true,
          subjects_taught: true,
          join_date: true,
        },
      },
      parent_of: {
        select: {
          id: true,
          student_code: true,
          gender: true,
          user: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              profile_photo: true,
            },
          },
          class: { select: { id: true, name: true } },
          level: { select: { id: true, name: true } },
          card: {
            select: {
              id: true,
              card_number: true,
              wallet_balance: true,
              is_active: true,
              is_frozen: true,
            },
          },
        },
      },
    },
  });
}

async function getUserContextProfile(userId, schoolId, role) {
  const profile = await getUserFullProfile(userId);
  if (!profile) return null;
  const [school, schoolMemberships, organizationMemberships, platformMembership] = await Promise.all([
    prisma.school.findUnique({ where: { id: schoolId }, select: { id: true, name: true, code: true, logo: true, email: true, phone: true, address: true, subscription_plan: true, organization_id: true } }),
    prisma.schoolMembership.findMany({ where: { user_id: userId, status: 'ACTIVE' }, select: { role: true, school_id: true } }),
    prisma.organizationMembership.findMany({ where: { user_id: userId, status: 'ACTIVE', role: 'ORGANIZATION_MANAGER' }, select: { organization_id: true } }),
    prisma.platformMembership.findFirst({ where: { user_id: userId, status: 'ACTIVE' }, select: { role: true } }),
  ]);
  if (!school) return null;
  const accessibleSchools = await prisma.school.findMany({
    where: platformMembership ? {} : {
      OR: [
        { id: { in: schoolMemberships.map((m) => m.school_id) } },
        { organization_id: { in: organizationMemberships.map((m) => m.organization_id) } },
      ],
    },
    select: { id: true, name: true, code: true, organization_id: true },
    orderBy: { name: 'asc' },
  });
  profile.school_id = schoolId;
  profile.role = role;
  profile.school = school;
  profile.available_schools = accessibleSchools.map((item) => ({
    id: item.id,
    name: item.name,
    code: item.code,
    role: platformMembership?.role || (item.organization_id && organizationMemberships.some((m) => m.organization_id === item.organization_id)
      ? 'ORGANIZATION_MANAGER' : schoolMemberships.find((m) => m.school_id === item.id)?.role || null),
  }));
  return profile;
}

module.exports = { login, refreshTokens, logout, getUserFullProfile, getUserContextProfile };
