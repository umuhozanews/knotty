const prisma = require('../../config/database');

async function createSchool(data) {
  const code = data.name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 6);

  const count = await prisma.school.count({ where: { code: { startsWith: code } } });
  const finalCode = count > 0 ? `${code}${count + 1}` : code;

  return prisma.school.create({ data: { ...data, code: finalCode } });
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
    present_today,
    fee_collected,
    canteen_today,
    low_balance_cards,
  ] = await Promise.all([
    prisma.student.count({ where: { school_id: schoolId, is_active: true } }),
    prisma.teacher.count({ where: { school_id: schoolId, is_active: true } }),
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

module.exports = { createSchool, getSchool, updateSchool, getDashboardStats, getAttendanceTrend };
