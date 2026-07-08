const prisma = require('../../config/database');
const { logAction } = require('../../utils/audit');
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

  logAction({
    school_id: schoolId,
    actor_user_id: recordedBy,
    action: 'DISCIPLINE_RECORD_CREATED',
    entity_type: 'DisciplineRecord',
    entity_id: record.id,
    after_state: {
      type: record.type,
      student_id: record.student_id,
      title: record.title,
    },
  }).catch(() => {});

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

async function update(id, schoolId, data, actorId) {
  const before = await prisma.disciplineRecord.findFirst({
    where: { id, school_id: schoolId },
    select: { type: true, status: true, title: true },
  });
  const result = await prisma.disciplineRecord.updateMany({ where: { id, school_id: schoolId }, data });
  logAction({
    school_id: schoolId,
    actor_user_id: actorId,
    action: 'DISCIPLINE_RECORD_UPDATED',
    entity_type: 'DisciplineRecord',
    entity_id: id,
    before_state: before,
    after_state: data,
  }).catch(() => {});
  return result;
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
