const bcrypt = require('bcryptjs');
const prisma = require('../../config/database');
const { generateStudentCode } = require('../../utils/cardNumberGenerator');
const { paginate, paginatedResponse } = require('../../utils/helpers');

async function createStudent(data, schoolId) {
  const school = await prisma.school.findUnique({ where: { id: schoolId } });
  if (!school) throw Object.assign(new Error('School not found'), { status: 404 });

  const student_code = await generateStudentCode(school.code);
  const password_hash = await bcrypt.hash(data.password, 10);

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        school_id: schoolId,
        role: 'STUDENT',
        first_name: data.first_name,
        last_name: data.last_name,
        email: data.email,
        phone: data.phone,
        password_hash,
      },
    });

    const student = await tx.student.create({
      data: {
        user_id: user.id,
        school_id: schoolId,
        student_code,
        date_of_birth: data.date_of_birth,
        gender: data.gender,
        nationality: data.nationality,
        level_id: data.level_id,
        class_id: data.class_id,
        parent_id: data.parent_id,
      },
      include: {
        user: { select: { id: true, first_name: true, last_name: true, email: true, phone: true } },
        level: true,
        class: true,
      },
    });

    return student;
  });
}

async function listStudents(schoolId, { page, limit, search, classId, levelId }) {
  const where = {
    school_id: schoolId,
    is_active: true,
    ...(classId && { class_id: classId }),
    ...(levelId && { level_id: levelId }),
    ...(search && {
      user: {
        OR: [
          { first_name: { contains: search, mode: 'insensitive' } },
          { last_name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ],
      },
    }),
  };

  const { skip, take } = paginate(null, page, limit);
  const [data, total] = await Promise.all([
    prisma.student.findMany({
      where,
      skip,
      take,
      include: {
        user: { select: { first_name: true, last_name: true, email: true, phone: true, profile_photo: true } },
        level: { select: { name: true } },
        class: { select: { name: true } },
        card: { select: { card_number: true, wallet_balance: true, is_active: true } },
      },
      orderBy: { created_at: 'desc' },
    }),
    prisma.student.count({ where }),
  ]);

  return paginatedResponse(data, total, page, limit);
}

async function getStudentById(id, schoolId) {
  const student = await prisma.student.findFirst({
    where: { id, school_id: schoolId },
    include: {
      user: { select: { first_name: true, last_name: true, email: true, phone: true, profile_photo: true } },
      level: true,
      class: true,
      card: true,
      parent: { select: { first_name: true, last_name: true, phone: true, email: true } },
    },
  });
  if (!student) throw Object.assign(new Error('Student not found'), { status: 404 });
  return student;
}

async function getFullProfile(id, schoolId) {
  const student = await getStudentById(id, schoolId);

  const [attendances, reports, health, discipline, achievements] = await Promise.all([
    prisma.attendance.findMany({
      where: { student_id: id },
      orderBy: { date: 'desc' },
      take: 30,
    }),
    prisma.academicReport.findMany({
      where: { student_id: id },
      orderBy: { created_at: 'desc' },
    }),
    prisma.healthRecord.findMany({
      where: { student_id: id },
      orderBy: { recorded_at: 'desc' },
      take: 10,
    }),
    prisma.disciplineRecord.findMany({
      where: { student_id: id },
      orderBy: { recorded_at: 'desc' },
      take: 10,
    }),
    prisma.achievement.findMany({
      where: { student_id: id },
      orderBy: { awarded_at: 'desc' },
    }),
  ]);

  return { ...student, attendances, reports, health, discipline, achievements };
}

async function updateStudent(id, schoolId, data) {
  const { first_name, last_name, phone, ...studentData } = data;

  return prisma.$transaction(async (tx) => {
    const student = await tx.student.findFirst({ where: { id, school_id: schoolId } });
    if (!student) throw Object.assign(new Error('Student not found'), { status: 404 });

    if (first_name || last_name || phone) {
      await tx.user.update({
        where: { id: student.user_id },
        data: { ...(first_name && { first_name }), ...(last_name && { last_name }), ...(phone && { phone }) },
      });
    }

    return tx.student.update({
      where: { id },
      data: studentData,
      include: {
        user: { select: { first_name: true, last_name: true, email: true, phone: true } },
      },
    });
  });
}

async function deleteStudent(id, schoolId) {
  const student = await prisma.student.findFirst({ where: { id, school_id: schoolId } });
  if (!student) throw Object.assign(new Error('Student not found'), { status: 404 });

  await prisma.$transaction([
    prisma.student.update({ where: { id }, data: { is_active: false } }),
    prisma.user.update({ where: { id: student.user_id }, data: { is_active: false } }),
  ]);
}

module.exports = { createStudent, listStudents, getStudentById, getFullProfile, updateStudent, deleteStudent };
