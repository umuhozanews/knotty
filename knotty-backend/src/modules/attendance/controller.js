const service = require('./service');

async function scan(req, res, next) {
  try {
    const result = await service.scanAttendance(req.body.card_number, req.user.id, req.body);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
}

async function bulk(req, res, next) {
  try {
    const { class_id, records } = req.body;
    const result = await service.bulkMarkAttendance(class_id, records, req.user.school_id, req.user.id);
    res.json({ success: true, data: result, count: result.length });
  } catch (err) { next(err); }
}

async function student(req, res, next) {
  try {
    if (req.user.role === 'STUDENT' || req.user.role === 'PARENT') {
      const prisma = require('../../config/database');
      const where = req.user.role === 'STUDENT'
        ? { id: req.params.studentId, user_id: req.user.id }
        : { id: req.params.studentId, school_id: req.user.school_id, parent_id: req.user.id };
      const ok = await prisma.student.findFirst({ where });
      if (!ok) return res.status(403).json({ success: false, message: 'Access denied' });
    }
    const { page = 1, limit = 30 } = req.query;
    const result = await service.getStudentAttendance(req.params.studentId, { page, limit });
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
}

async function byClass(req, res, next) {
  try {
    const result = await service.getClassAttendance(req.params.classId, req.query.date);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
}

async function report(req, res, next) {
  try {
    if (req.user.role === 'STUDENT' || req.user.role === 'PARENT') {
      const prisma = require('../../config/database');
      const where = req.user.role === 'STUDENT'
        ? { id: req.params.studentId, user_id: req.user.id }
        : { id: req.params.studentId, school_id: req.user.school_id, parent_id: req.user.id };
      const ok = await prisma.student.findFirst({ where });
      if (!ok) return res.status(403).json({ success: false, message: 'Access denied' });
    }
    const { from, to } = req.query;
    const result = await service.getAttendanceReport(req.params.studentId, { from, to });
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
}

async function scanNFC(req, res, next) {
  try {
    const result = await service.scanAttendanceByNFC(req.body.nfc_uid, req.user.id, req.body, req.user.school_id);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
}

async function todaySummary(req, res, next) {
  try {
    const { classId } = req.query;
    const result = await service.getTodaySummary(req.user.school_id, classId, req.user);
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
}

async function myAttendance(req, res, next) {
  try {
    const prisma = require('../../config/database');
    const studentRecord = await prisma.student.findFirst({
      where: { user_id: req.user.id, school_id: req.user.school_id },
    });
    if (!studentRecord) return res.status(404).json({ success: false, message: 'Student record not found' });
    const { page = 1, limit = 60 } = req.query;
    const result = await service.getStudentAttendance(studentRecord.id, { page, limit });
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
}

async function scanSecure(req, res, next) {
  try {
    const result = await service.scanAttendanceSecure(req.body.token, req.user.id, req.body);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
}

async function pdfByClass(req, res, next) {
  try {
    const buffer = await service.classPDF(req.params.classId, req.query.date, req.user.school_id);
    const dateLabel = (req.query.date || new Date().toISOString().slice(0, 10)).replace(/-/g, '');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="attendance_${dateLabel}.pdf"`);
    res.end(buffer);
  } catch (err) { next(err); }
}

module.exports = { scan, bulk, student, byClass, report, scanNFC, todaySummary, myAttendance, scanSecure, pdfByClass };
