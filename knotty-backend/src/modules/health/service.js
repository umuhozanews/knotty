const prisma = require('../../config/database');
const { paginate, paginatedResponse } = require('../../utils/helpers');

async function create(data, recordedBy, schoolId) {
  return prisma.healthRecord.create({
    data: { ...data, recorded_by: recordedBy, school_id: schoolId },
  });
}

async function list(studentId, { page, limit }) {
  const { skip, take } = paginate(null, page, limit);
  const [data, total] = await Promise.all([
    prisma.healthRecord.findMany({
      where: { student_id: studentId },
      skip,
      take,
      orderBy: { recorded_at: 'desc' },
      include: { recorder: { select: { first_name: true, last_name: true, role: true } } },
    }),
    prisma.healthRecord.count({ where: { student_id: studentId } }),
  ]);
  return paginatedResponse(data, total, page, limit);
}

async function update(id, schoolId, data) {
  return prisma.healthRecord.updateMany({ where: { id, school_id: schoolId }, data });
}

async function remove(id, schoolId) {
  return prisma.healthRecord.deleteMany({ where: { id, school_id: schoolId } });
}

module.exports = { create, list, update, remove };
