const prisma = require('../../config/database');
const { paginate, paginatedResponse } = require('../../utils/helpers');

async function create(data, recordedBy, schoolId) {
  const student = await prisma.student.findFirst({ where: { id: data.student_id, school_id: schoolId }, select: { id: true } });
  if (!student) throw Object.assign(new Error('Student not found'), { status: 404 });
  return prisma.achievement.create({
    data: { ...data, recorded_by: recordedBy, school_id: schoolId },
  });
}

async function list(studentId, schoolId, { page, limit }) {
  const { skip, take } = paginate(null, page, limit);
  const [data, total] = await Promise.all([
    prisma.achievement.findMany({
      where: { student_id: studentId, school_id: schoolId },
      skip,
      take,
      orderBy: { awarded_at: 'desc' },
    }),
    prisma.achievement.count({ where: { student_id: studentId, school_id: schoolId } }),
  ]);
  return paginatedResponse(data, total, page, limit);
}

module.exports = { create, list };
