const prisma = require('../../config/database');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

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

  // Automatically create standard levels (S1 - S6) for the new school
  const levels = ['Senior 1', 'Senior 2', 'Senior 3', 'Senior 4', 'Senior 5', 'Senior 6'];
  for (let i = 0; i < levels.length; i++) {
    const level = await prisma.level.create({
      data: { school_id: school.id, name: levels[i], order_index: i + 1 },
    });
    // Add default section A
    await prisma.class.create({
      data: { school_id: school.id, level_id: level.id, name: 'A', academic_year: '2025-2026' },
    });
  }

  return school;
}

async function listAllSchools() {
  const schools = await prisma.school.findMany({
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

async function switchSchool(userId, targetSchoolId) {
  const school = await prisma.school.findUnique({ where: { id: targetSchoolId } });
  if (!school) throw Object.assign(new Error('Target school not found'), { status: 404 });

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw Object.assign(new Error('User not found'), { status: 404 });

  // Generate new tokens scoped to targetSchoolId
  const jti = crypto.randomUUID();
  const payload = { userId: user.id, role: user.role, schoolId: school.id, jti };
  const accessToken = jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
  });
  const refreshToken = jwt.sign({ userId: user.id, role: user.role, schoolId: school.id }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  });

  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      role: user.role,
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
  listAllSchools,
  switchSchool,
  getSchool,
  updateSchool,
  getDashboardStats,
  getAttendanceTrend,
};
