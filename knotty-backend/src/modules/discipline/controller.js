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
      const student = await prisma.student.findFirst({ where: { id: studentId, user_id: req.user.id } });
      if (!student) return res.status(403).json({ success: false, message: 'Access denied' });
    } else if (req.user.role === 'PARENT') {
      const student = await prisma.student.findFirst({ where: { id: studentId, school_id: req.user.school_id, parent_id: req.user.id } });
      if (!student) return res.status(403).json({ success: false, message: 'Access denied: not your child' });
    }

    const result = await service.list(studentId, { page, limit });
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
}

async function update(req, res, next) {
  try {
    await service.update(req.params.id, req.user.school_id, req.body);
    res.json({ success: true, message: 'Updated' });
  } catch (err) { next(err); }
}

async function listSchool(req, res, next) {
  try {
    const { page = 1, limit = 20, search } = req.query;
    const result = await service.listForSchool(req.user.school_id, { page, limit, search });
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
}

module.exports = { create, list, update, listSchool };
