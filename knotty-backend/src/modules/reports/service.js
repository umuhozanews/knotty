const prisma = require('../../config/database');
const { generateReportCard } = require('../../utils/pdfGenerator');
const { paginate, paginatedResponse } = require('../../utils/helpers');

async function create(data, schoolId) {
  const { student_id, term, academic_year, subjects, overall_grade, class_position, teacher_comment, principal_comment, conduct_grade } = data;
  return prisma.academicReport.create({
    data: { student_id, term, academic_year, subjects, overall_grade, class_position, teacher_comment, principal_comment, conduct_grade, school_id: schoolId },
  });
}

async function listForStudent(studentId, { page, limit, publishedOnly = false }) {
  const { skip, take } = paginate(null, page, limit);
  const where = { student_id: studentId, ...(publishedOnly && { is_published: true }) };
  const [data, total] = await Promise.all([
    prisma.academicReport.findMany({ where, skip, take, orderBy: { created_at: 'desc' } }),
    prisma.academicReport.count({ where }),
  ]);
  return paginatedResponse(data, total, page, limit);
}

async function getOne(id, schoolId) {
  const report = await prisma.academicReport.findFirst({ where: { id, school_id: schoolId } });
  if (!report) throw Object.assign(new Error('Report not found'), { status: 404 });
  return report;
}

async function update(id, schoolId, data) {
  return prisma.academicReport.updateMany({ where: { id, school_id: schoolId }, data });
}

async function publish(id, schoolId) {
  return prisma.academicReport.updateMany({
    where: { id, school_id: schoolId },
    data: { is_published: true, published_at: new Date() },
  });
}

async function generatePDF(id, schoolId) {
  const report = await prisma.academicReport.findFirst({
    where: { id, school_id: schoolId },
  });
  if (!report) throw Object.assign(new Error('Report not found'), { status: 404 });

  const [student, school] = await Promise.all([
    prisma.student.findUnique({
      where: { id: report.student_id },
      include: {
        user: { select: { first_name: true, last_name: true, profile_photo: true } },
        class: { include: { level: true } },
      },
    }),
    prisma.school.findUnique({ where: { id: schoolId } }),
  ]);

  return generateReportCard(report, student, school);
}

module.exports = { create, listForStudent, getOne, update, publish, generatePDF };
