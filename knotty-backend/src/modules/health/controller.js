const service = require('./service');

// ─── Incident Logs (Legacy/Basic) ───
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

async function listSchool(req, res, next) {
  try {
    const { page = 1, limit = 30 } = req.query;
    const result = await service.listSchool(req.user.school_id, { page: Number(page), limit: Number(limit) });
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
}

async function update(req, res, next) {
  try {
    await service.update(req.params.id, req.user.school_id, req.body);
    res.json({ success: true, message: 'Updated' });
  } catch (err) { next(err); }
}

async function remove(req, res, next) {
  try {
    await service.remove(req.params.id, req.user.school_id);
    res.json({ success: true, message: 'Deleted' });
  } catch (err) { next(err); }
}

// ─── Advanced Medical Profile ───
async function getMedicalProfile(req, res, next) {
  try {
    const { studentId } = req.params;
    const prisma = require('../../config/database');

    if (req.user.role === 'STUDENT') {
      const student = await prisma.student.findFirst({ where: { id: studentId, user_id: req.user.id } });
      if (!student) return res.status(403).json({ success: false, message: 'Access denied' });
    } else if (req.user.role === 'PARENT') {
      const student = await prisma.student.findFirst({ where: { id: studentId, school_id: req.user.school_id, parent_id: req.user.id } });
      if (!student) return res.status(403).json({ success: false, message: 'Access denied: not your child' });
    }

    const result = await service.getMedicalProfile(studentId, req.user.school_id);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
}

async function upsertMedicalProfile(req, res, next) {
  try {
    const result = await service.upsertMedicalProfile(req.params.studentId, req.user.school_id, req.body);
    res.json({ success: true, data: result, message: 'Medical profile saved successfully' });
  } catch (err) { next(err); }
}

// ─── Immunization Records ───
async function addImmunizationRecord(req, res, next) {
  try {
    const result = await service.addImmunizationRecord(req.params.studentId, req.body);
    res.status(201).json({ success: true, data: result });
  } catch (err) { next(err); }
}

async function listImmunizations(req, res, next) {
  try {
    const { studentId } = req.params;
    const prisma = require('../../config/database');

    if (req.user.role === 'STUDENT') {
      const student = await prisma.student.findFirst({ where: { id: studentId, user_id: req.user.id } });
      if (!student) return res.status(403).json({ success: false, message: 'Access denied' });
    } else if (req.user.role === 'PARENT') {
      const student = await prisma.student.findFirst({ where: { id: studentId, school_id: req.user.school_id, parent_id: req.user.id } });
      if (!student) return res.status(403).json({ success: false, message: 'Access denied: not your child' });
    }

    const result = await service.listImmunizations(studentId);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
}

async function removeImmunizationRecord(req, res, next) {
  try {
    await service.removeImmunizationRecord(req.params.id, req.user.school_id);
    res.json({ success: true, message: 'Immunization record deleted successfully' });
  } catch (err) { next(err); }
}

// ─── Clinic Visits ───
async function createClinicVisit(req, res, next) {
  try {
    const result = await service.createClinicVisit(req.params.studentId, req.user.school_id, req.body, req.user.id);
    res.status(201).json({ success: true, data: result });
  } catch (err) { next(err); }
}

async function listClinicVisits(req, res, next) {
  try {
    const { studentId } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const prisma = require('../../config/database');

    if (req.user.role === 'STUDENT') {
      const student = await prisma.student.findFirst({ where: { id: studentId, user_id: req.user.id } });
      if (!student) return res.status(403).json({ success: false, message: 'Access denied' });
    } else if (req.user.role === 'PARENT') {
      const student = await prisma.student.findFirst({ where: { id: studentId, school_id: req.user.school_id, parent_id: req.user.id } });
      if (!student) return res.status(403).json({ success: false, message: 'Access denied: not your child' });
    }

    const result = await service.listClinicVisits(studentId, req.user.school_id, {
      page: Number(page),
      limit: Number(limit)
    });
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
}

async function listAllClinicVisits(req, res, next) {
  try {
    const { page = 1, limit = 30 } = req.query;
    const result = await service.listClinicVisits(null, req.user.school_id, {
      page: Number(page),
      limit: Number(limit)
    });
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
}

module.exports = {
  create,
  list,
  listSchool,
  update,
  remove,
  getMedicalProfile,
  upsertMedicalProfile,
  addImmunizationRecord,
  listImmunizations,
  removeImmunizationRecord,
  createClinicVisit,
  listClinicVisits,
  listAllClinicVisits,
};
