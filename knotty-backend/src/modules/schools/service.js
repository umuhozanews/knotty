const prisma = require('../../config/database');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const redis = require('../../config/redis');

async function createSchool(data) {
  const code = (data.code || data.name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 6)).trim().toUpperCase();

  const count = await prisma.school.count({ where: { code: { startsWith: code } } });
  const finalCode = count > 0 ? `${code}${count + 1}` : code;

  const school = await prisma.school.create({
    data: {
      ...data,
      code: finalCode,
    },
  });

  // Classes, levels, terms, and timetables are explicitly configured per school
  // after onboarding; do not create stale demo-year academic records here.
  return school;
}

async function createOrganization({ name, slug, legal_name, tin }) {
  if (!name || !slug) throw Object.assign(new Error('Organization name and slug are required'), { status: 400 });
  return prisma.organization.create({
    data: { name: String(name).trim(), slug: String(slug).trim().toLowerCase(), legal_name: legal_name || null, tin: tin || null },
  });
}

async function setOrganizationManager(organizationId, userId, role = 'ORGANIZATION_MANAGER') {
  if (!['ORGANIZATION_MANAGER'].includes(role)) throw Object.assign(new Error('Invalid organization role'), { status: 400 });
  const [organization, user] = await Promise.all([
    prisma.organization.findUnique({ where: { id: organizationId }, select: { id: true } }),
    prisma.user.findUnique({ where: { id: userId }, select: { id: true, is_active: true } }),
  ]);
  if (!organization || !user || !user.is_active) throw Object.assign(new Error('Active organization and user are required'), { status: 404 });
  return prisma.organizationMembership.upsert({
    where: { organization_id_user_id: { organization_id: organizationId, user_id: userId } },
    create: { organization_id: organizationId, user_id: userId, role, status: 'ACTIVE' },
    update: { role, status: 'ACTIVE' },
  });
}

async function attachSchoolToOrganization(organizationId, schoolId, branchCode = null) {
  const organization = await prisma.organization.findUnique({ where: { id: organizationId }, select: { id: true } });
  if (!organization) throw Object.assign(new Error('Organization not found'), { status: 404 });
  try {
    return await prisma.school.update({
      where: { id: schoolId },
      data: { organization_id: organizationId, branch_code: branchCode ? String(branchCode).trim() : null },
    });
  } catch (error) {
    if (error.code === 'P2025') throw Object.assign(new Error('School not found'), { status: 404 });
    throw error;
  }
}

async function listAllSchools(userId) {
  const [memberships, orgMemberships, platformMembership] = await Promise.all([prisma.schoolMembership.findMany({
    where: { user_id: userId, status: 'ACTIVE' }, select: { school_id: true },
  }), prisma.organizationMembership.findMany({
    where: { user_id: userId, status: 'ACTIVE', role: 'ORGANIZATION_MANAGER' },
    select: { role: true, organization_id: true },
  }), prisma.platformMembership.findFirst({ where: { user_id: userId, status: 'ACTIVE' } })]);
  const isPlatformAdmin = !!platformMembership;
  const schools = await prisma.school.findMany({
    where: isPlatformAdmin ? {} : {
      OR: [
        { id: { in: memberships.map((m) => m.school_id) } },
        { organization_id: { in: orgMemberships.map((m) => m.organization_id) } },
      ],
    },
    orderBy: { created_at: 'asc' },
  });

  const enriched = await Promise.all(
    schools.map(async (s) => {
      const [students, workers, classes, canteenProducts] = await Promise.all([
        prisma.student.count({ where: { school_id: s.id, is_active: true } }),
        prisma.user.count({
          where: {
            school_id: s.id,
            role: { in: ['TEACHER', 'CANTEEN', 'BURSAR', 'NURSE', 'DISCIPLINE', 'LIBRARIAN', 'ADMIN'] },
            is_active: true,
          },
        }),
        prisma.class.count({ where: { school_id: s.id } }),
        prisma.canteenProduct.count({ where: { school_id: s.id } }),
      ]);

      return {
        ...s,
        student_count: students,
        worker_count: workers,
        class_count: classes,
        canteen_products_count: canteenProducts,
      };
    })
  );

  return enriched;
}

async function switchSchool(userId, targetSchoolId, sessionId) {
  if (!sessionId) throw Object.assign(new Error('A valid login session is required'), { status: 401 });
  const school = await prisma.school.findUnique({ where: { id: targetSchoolId } });
  if (!school) throw Object.assign(new Error('Target school not found'), { status: 404 });

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw Object.assign(new Error('User not found'), { status: 404 });

  const [membership, orgMembership, platformMembership] = await Promise.all([
    prisma.schoolMembership.findFirst({ where: { user_id: userId, school_id: school.id, status: 'ACTIVE' } }),
    school.organization_id ? prisma.organizationMembership.findFirst({
      where: { user_id: userId, organization_id: school.organization_id, status: 'ACTIVE' },
    }) : null,
    prisma.platformMembership.findFirst({ where: { user_id: userId, status: 'ACTIVE' } }),
  ]);
  const effectiveRole = platformMembership?.role || (
    orgMembership?.role === 'ORGANIZATION_MANAGER' ? orgMembership.role : membership?.role
  );
  if (!effectiveRole) throw Object.assign(new Error('You do not have active access to this school'), { status: 403 });

  // Generate new tokens scoped to targetSchoolId
  const jti = crypto.randomUUID();
  const payload = { userId: user.id, role: effectiveRole, schoolId: school.id, sid: sessionId, jti };
  const accessToken = jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
  });
  const refreshToken = jwt.sign({ userId: user.id, role: effectiveRole, schoolId: school.id, sid: sessionId }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  });
  await redis.set(`refresh:${sessionId}`, refreshToken, 'EX', 7 * 24 * 3600);
  await redis.set(`session:${sessionId}`, user.id, 'EX', 7 * 24 * 3600);

  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      role: effectiveRole,
      school_id: school.id,
      first_name: user.first_name,
      last_name: user.last_name,
      email: user.email,
      profile_photo: user.profile_photo,
    },
    school: {
      id: school.id,
      name: school.name,
      code: school.code,
      email: school.email,
      phone: school.phone,
      address: school.address,
      subscription_plan: school.subscription_plan,
    },
  };
}

async function canAccessSchool(userId, schoolId) {
  const platformMembership = await prisma.platformMembership.findFirst({ where: { user_id: userId, status: 'ACTIVE' }, select: { id: true } });
  if (platformMembership) return !!(await prisma.school.findUnique({ where: { id: schoolId }, select: { id: true } }));
  const school = await prisma.school.findUnique({ where: { id: schoolId }, select: { id: true, organization_id: true } });
  if (!school) return false;
  const membership = await prisma.schoolMembership.findFirst({
    where: { user_id: userId, school_id: schoolId, status: 'ACTIVE' }, select: { id: true },
  });
  if (membership) return true;
  if (!school.organization_id) return false;
  const orgMembership = await prisma.organizationMembership.findFirst({
    where: { user_id: userId, organization_id: school.organization_id, status: 'ACTIVE', role: 'ORGANIZATION_MANAGER' },
    select: { id: true },
  });
  return !!orgMembership;
}

async function listMemberships(schoolId) {
  return prisma.schoolMembership.findMany({
    where: { school_id: schoolId },
    select: {
      id: true, role: true, status: true, created_at: true,
      user: { select: { id: true, first_name: true, last_name: true, email: true, is_active: true } },
    },
    orderBy: { created_at: 'asc' },
  });
}

async function addMembership(schoolId, userId, role) {
  const allowed = ['SCHOOL_MANAGER', 'ADMIN', 'TEACHER', 'STUDENT', 'PARENT', 'CANTEEN', 'NURSE', 'BURSAR', 'DISCIPLINE', 'LIBRARIAN'];
  if (!allowed.includes(role)) throw Object.assign(new Error('Invalid school role'), { status: 400 });
  const [school, user] = await Promise.all([
    prisma.school.findUnique({ where: { id: schoolId }, select: { id: true } }),
    prisma.user.findUnique({ where: { id: userId }, select: { id: true, is_active: true } }),
  ]);
  if (!school || !user || !user.is_active) throw Object.assign(new Error('Active school and user are required'), { status: 404 });
  return prisma.schoolMembership.upsert({
    where: { user_id_school_id: { user_id: userId, school_id: schoolId } },
    create: { user_id: userId, school_id: schoolId, role, status: 'ACTIVE' },
    update: { role, status: 'ACTIVE' },
    select: { id: true, role: true, status: true, school_id: true, user_id: true },
  });
}

async function revokeMembership(schoolId, membershipId, actorId) {
  const membership = await prisma.schoolMembership.findFirst({ where: { id: membershipId, school_id: schoolId } });
  if (!membership) throw Object.assign(new Error('Membership not found'), { status: 404 });
  if (membership.user_id === actorId) throw Object.assign(new Error('You cannot revoke your own membership'), { status: 400 });
  return prisma.schoolMembership.update({
    where: { id: membership.id }, data: { status: 'REVOKED' },
    select: { id: true, user_id: true, school_id: true, role: true, status: true },
  });
}

async function getSchool(id) {
  const school = await prisma.school.findUnique({ where: { id } });
  if (!school) throw Object.assign(new Error('School not found'), { status: 404 });
  return school;
}

async function updateSchool(id, data) {
  return prisma.school.update({ where: { id }, data });
}

async function getDashboardStats(schoolId) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [
    total_students,
    total_teachers,
    total_workers,
    present_today,
    fee_collected,
    canteen_today,
    low_balance_cards,
  ] = await Promise.all([
    prisma.student.count({ where: { school_id: schoolId, is_active: true } }),
    prisma.teacher.count({ where: { school_id: schoolId, is_active: true } }),
    prisma.user.count({
      where: {
        school_id: schoolId,
        role: { in: ['TEACHER', 'CANTEEN', 'BURSAR', 'NURSE', 'DISCIPLINE', 'LIBRARIAN', 'ADMIN'] },
        is_active: true,
      },
    }),
    prisma.attendance.count({
      where: { school_id: schoolId, date: today, status: { in: ['PRESENT', 'LATE'] } },
    }),
    prisma.feePayment.aggregate({
      where: { school_id: schoolId, status: 'COMPLETED' },
      _sum: { amount: true },
    }),
    prisma.canteenTransaction.aggregate({
      where: { school_id: schoolId, transaction_time: { gte: today } },
      _sum: { total_amount: true },
      _count: true,
    }),
    prisma.knottyCard.count({
      where: { school_id: schoolId, is_active: true, wallet_balance: { lt: 1000 } },
    }),
  ]);

  return {
    total_students,
    total_teachers,
    total_workers,
    present_today,
    fee_collected: fee_collected._sum.amount || 0,
    canteen_revenue_today: canteen_today._sum.total_amount || 0,
    canteen_transactions_today: canteen_today._count,
    low_balance_cards,
  };
}

async function getAttendanceTrend(schoolId, days = 9) {
  const results = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);

    const [present, absent] = await Promise.all([
      prisma.attendance.count({
        where: { school_id: schoolId, date: d, status: { in: ['PRESENT', 'LATE'] } },
      }),
      prisma.attendance.count({
        where: { school_id: schoolId, date: d, status: { in: ['ABSENT', 'EXCUSED'] } },
      }),
    ]);

    results.push({
      date: d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
      present,
      absence: absent,
    });
  }
  return results;
}

module.exports = {
  createSchool,
  createOrganization,
  setOrganizationManager,
  attachSchoolToOrganization,
  listAllSchools,
  switchSchool,
  canAccessSchool,
  listMemberships,
  addMembership,
  revokeMembership,
  getSchool,
  updateSchool,
  getDashboardStats,
  getAttendanceTrend,
};
