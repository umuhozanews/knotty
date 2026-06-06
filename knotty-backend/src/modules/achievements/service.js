const prisma = require('../../config/database');
const { paginate, paginatedResponse } = require('../../utils/helpers');

async function create(data, recordedBy, schoolId) {
  return prisma.achievement.create({
    data: { ...data, recorded_by: recordedBy, school_id: schoolId },
  });
}

async function list(studentId, { page, limit }) {
  const { skip, take } = paginate(null, page, limit);
  const [data, total] = await Promise.all([
    prisma.achievement.findMany({
      where: { student_id: studentId },
      skip,
      take,
      orderBy: { awarded_at: 'desc' },
    }),
    prisma.achievement.count({ where: { student_id: studentId } }),
  ]);
  return paginatedResponse(data, total, page, limit);
}

module.exports = { create, list };
