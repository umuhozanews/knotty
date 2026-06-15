const service = require('./service');

async function verifyTeacherStudentAccess(userId, studentId, schoolId) {
  const prisma = require('../../config/database');
  const student = await prisma.student.findFirst({
    where: { id: studentId, school_id: schoolId }
  });
  if (!student) return false;

  const teacher = await prisma.teacher.findFirst({
    where: { user_id: userId, school_id: schoolId }
  });
  if (!teacher || !teacher.subjects_taught) return false;
  const assignments = teacher.subjects_taught;
  if (!Array.isArray(assignments)) return false;
  return assignments.some(a => a.class_id === student.class_id);
}

async function create(req, res, next) {
  try {
    if (req.user.role === 'TEACHER') {
      const hasAccess = await verifyTeacherStudentAccess(req.user.id, req.body.student_id, req.user.school_id);
      if (!hasAccess) {
        return res.status(403).json({ success: false, message: 'Access denied: You are not assigned to this student\'s class.' });
      }
    }
    const report = await service.create(req.body, req.user.school_id);
    res.status(201).json({ success: true, data: report });
  } catch (err) { next(err); }
}

async function forStudent(req, res, next) {
  try {
    if (req.user.role === 'TEACHER') {
      const hasAccess = await verifyTeacherStudentAccess(req.user.id, req.params.studentId, req.user.school_id);
      if (!hasAccess) {
        return res.status(403).json({ success: false, message: 'Access denied: You are not assigned to this student\'s class.' });
      }
    }
    const { page = 1, limit = 10 } = req.query;
    const result = await service.listForStudent(req.params.studentId, { page, limit });
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
}

async function getOne(req, res, next) {
  try {
    if (req.user.role === 'TEACHER') {
      const prisma = require('../../config/database');
      const report = await prisma.academicReport.findFirst({ where: { id: req.params.id } });
      if (!report) return res.status(404).json({ success: false, message: 'Report not found' });
      const hasAccess = await verifyTeacherStudentAccess(req.user.id, report.student_id, req.user.school_id);
      if (!hasAccess) {
        return res.status(403).json({ success: false, message: 'Access denied: You are not assigned to this student\'s class.' });
      }
    }
    const report = await service.getOne(req.params.id);
    res.json({ success: true, data: report });
  } catch (err) { next(err); }
}

async function update(req, res, next) {
  try {
    if (req.user.role === 'TEACHER') {
      const prisma = require('../../config/database');
      const report = await prisma.academicReport.findFirst({ where: { id: req.params.id, school_id: req.user.school_id } });
      if (!report) return res.status(404).json({ success: false, message: 'Report not found' });
      const hasAccess = await verifyTeacherStudentAccess(req.user.id, report.student_id, req.user.school_id);
      if (!hasAccess) {
        return res.status(403).json({ success: false, message: 'Access denied: You are not assigned to this student\'s class.' });
      }
    }
    await service.update(req.params.id, req.user.school_id, req.body);
    res.json({ success: true, message: 'Updated' });
  } catch (err) { next(err); }
}

async function publish(req, res, next) {
  try {
    await service.publish(req.params.id, req.user.school_id);
    res.json({ success: true, message: 'Report published' });
  } catch (err) { next(err); }
}

async function pdf(req, res, next) {
  try {
    if (req.user.role === 'TEACHER') {
      const prisma = require('../../config/database');
      const report = await prisma.academicReport.findFirst({ where: { id: req.params.id, school_id: req.user.school_id } });
      if (!report) return res.status(404).json({ success: false, message: 'Report not found' });
      const hasAccess = await verifyTeacherStudentAccess(req.user.id, report.student_id, req.user.school_id);
      if (!hasAccess) {
        return res.status(403).json({ success: false, message: 'Access denied: You are not assigned to this student\'s class.' });
      }
    }
    const buffer = await service.generatePDF(req.params.id, req.user.school_id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="report_${req.params.id}.pdf"`);
    res.end(buffer);
  } catch (err) { next(err); }
}

async function myReports(req, res, next) {
  try {
    const prisma = require('../../config/database');
    const student = await prisma.student.findFirst({ where: { user_id: req.user.id, school_id: req.user.school_id } });
    if (!student) return res.status(404).json({ success: false, message: 'Student record not found' });
    const { page = 1, limit = 10 } = req.query;
    const result = await service.listForStudent(student.id, { page, limit, publishedOnly: true });
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
}

module.exports = { create, forStudent, getOne, update, publish, pdf, myReports };
