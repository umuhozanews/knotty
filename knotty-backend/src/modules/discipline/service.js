const prisma = require('../../config/database');
const { sendSMS } = require('../../integrations/africas-talking');
const { paginate, paginatedResponse } = require('../../utils/helpers');

async function create(data, recordedBy, schoolId) {
  const record = await prisma.disciplineRecord.create({
    data: { ...data, recorded_by: recordedBy, school_id: schoolId },
    include: {
      student: {
        include: {
          user: { select: { first_name: true, last_name: true } },
          parent: { select: { phone: true } },
        },
      },
    },
  });

  if (record.student.parent?.phone) {
    const name = `${record.student.user.first_name} ${record.student.user.last_name}`;
    sendSMS(
      record.student.parent.phone,
      `KNOTTY Alert: A discipline record (${record.type}) has been filed for ${name}. Contact school for details.`
    ).catch(console.error);
  }

  return record;
}

async function list(studentId, { page, limit }) {
  const { skip, take } = paginate(null, page, limit);
  const [data, total] = await Promise.all([
    prisma.disciplineRecord.findMany({
      where: { student_id: studentId },
      skip,
      take,
      orderBy: { recorded_at: 'desc' },
      include: { recorder: { select: { first_name: true, last_name: true, role: true } } },
    }),
    prisma.disciplineRecord.count({ where: { student_id: studentId } }),
  ]);
  return paginatedResponse(data, total, page, limit);
}

async function update(id, schoolId, data) {
  return prisma.disciplineRecord.updateMany({ where: { id, school_id: schoolId }, data });
}

async function listForSchool(schoolId, { page, limit, search }) {
  const { skip, take } = paginate(null, page, limit);
  const where = {
    school_id: schoolId,
    ...(search && {
      OR: [
        { title: { contains: search, mode: 'insensitive' } },
        { student: { user: { first_name: { contains: search, mode: 'insensitive' } } } },
        { student: { user: { last_name: { contains: search, mode: 'insensitive' } } } },
      ],
    }),
  };
  const [data, total] = await Promise.all([
    prisma.disciplineRecord.findMany({
      where,
      skip,
      take,
      orderBy: { recorded_at: 'desc' },
      include: {
        student: { include: { user: { select: { first_name: true, last_name: true } } } },
        recorder: { select: { first_name: true, last_name: true, role: true } },
      },
    }),
    prisma.disciplineRecord.count({ where }),
  ]);
  return paginatedResponse(data, total, page, limit);
}

module.exports = { create, list, update, listForSchool };
