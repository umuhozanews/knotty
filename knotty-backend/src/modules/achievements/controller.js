const service = require('./service');

async function create(req, res, next) {
  try {
    const record = await service.create(req.body, req.user.id, req.user.school_id);
    res.status(201).json({ success: true, data: record });
  } catch (err) { next(err); }
}

async function list(req, res, next) {
  try {
    const { page = 1, limit = 20 } = req.query;
    const { studentId } = req.params;
    const prisma = require('../../config/database');
    if (req.user.role === 'STUDENT') {
      const student = await prisma.student.findFirst({ where: { id: studentId, user_id: req.user.id, school_id: req.user.school_id } });
      if (!student) return res.status(403).json({ success: false, message: 'Access denied' });
    } else if (req.user.role === 'PARENT') {
      const student = await prisma.student.findFirst({ where: { id: studentId, parent_id: req.user.id, school_id: req.user.school_id } });
      if (!student) return res.status(403).json({ success: false, message: 'Access denied: not your child' });
    } else if (!['ADMIN', 'TEACHER'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Insufficient permissions' });
    }
    const result = await service.list(studentId, req.user.school_id, { page, limit });
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
}

module.exports = { create, list };
