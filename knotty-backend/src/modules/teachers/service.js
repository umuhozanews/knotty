const bcrypt = require('bcryptjs');
const prisma = require('../../config/database');
const { paginate, paginatedResponse } = require('../../utils/helpers');

async function create(data, schoolId) {
  const { first_name, last_name, email, phone, password = 'Knotty@2024', ...teacherData } = data;
  const password_hash = await bcrypt.hash(password, 10);

  const count = await prisma.teacher.count({ where: { school_id: schoolId } });
  const employee_code = `TCH-${schoolId.slice(0, 4).toUpperCase()}-${String(count + 1).padStart(4, '0')}`;

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { school_id: schoolId, role: 'TEACHER', first_name, last_name, email, phone, password_hash },
    });
    return tx.teacher.create({
      data: { user_id: user.id, school_id: schoolId, employee_code, ...teacherData },
      include: { user: { select: { first_name: true, last_name: true, email: true, phone: true } } },
    });
  });
}

async function list(schoolId, { page, limit }) {
  const { skip, take } = paginate(null, page, limit);
  const [data, total] = await Promise.all([
    prisma.teacher.findMany({
      where: { school_id: schoolId, is_active: true },
      skip,
      take,
      include: { user: { select: { first_name: true, last_name: true, email: true, profile_photo: true } } },
      orderBy: { created_at: 'desc' },
    }),
    prisma.teacher.count({ where: { school_id: schoolId, is_active: true } }),
  ]);
  return paginatedResponse(data, total, page, limit);
}

async function getOne(id, schoolId) {
  const teacher = await prisma.teacher.findFirst({
    where: { id, school_id: schoolId },
    include: { user: { select: { first_name: true, last_name: true, email: true, phone: true, profile_photo: true } } },
  });
  if (!teacher) throw Object.assign(new Error('Teacher not found'), { status: 404 });
  return teacher;
}

async function update(id, schoolId, data) {
  const { first_name, last_name, phone, ...teacherData } = data;
  return prisma.$transaction(async (tx) => {
    const teacher = await tx.teacher.findFirst({ where: { id, school_id: schoolId } });
    if (!teacher) throw Object.assign(new Error('Teacher not found'), { status: 404 });
    if (first_name || last_name || phone) {
      await tx.user.update({ where: { id: teacher.user_id }, data: { first_name, last_name, phone } });
    }
    return tx.teacher.update({ where: { id }, data: teacherData });
  });
}

module.exports = { create, list, getOne, update };
