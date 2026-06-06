const service = require('./service');

async function create(req, res, next) {
  try {
    const student = await service.createStudent(req.body, req.user.school_id);
    res.status(201).json({ success: true, data: student });
  } catch (err) { next(err); }
}

async function list(req, res, next) {
  try {
    const { page = 1, limit = 20, search, classId, levelId } = req.query;
    const result = await service.listStudents(req.user.school_id, { page, limit, search, classId, levelId });
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
}

async function getOne(req, res, next) {
  try {
    const student = await service.getStudentById(req.params.id, req.user.school_id);
    res.json({ success: true, data: student });
  } catch (err) { next(err); }
}

async function fullProfile(req, res, next) {
  try {
    const data = await service.getFullProfile(req.params.id, req.user.school_id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

async function update(req, res, next) {
  try {
    const student = await service.updateStudent(req.params.id, req.user.school_id, req.body);
    res.json({ success: true, data: student });
  } catch (err) { next(err); }
}

async function remove(req, res, next) {
  try {
    await service.deleteStudent(req.params.id, req.user.school_id);
    res.json({ success: true, message: 'Student deactivated' });
  } catch (err) { next(err); }
}

async function myProfile(req, res, next) {
  try {
    const prisma = require('../../config/database');
    const student = await prisma.student.findFirst({
      where: { user_id: req.user.id, school_id: req.user.school_id },
      include: {
        user: { select: { first_name: true, last_name: true, email: true, phone: true, profile_photo: true } },
        level: { select: { id: true, name: true } },
        class: { select: { id: true, name: true } },
        card: { select: { card_number: true, wallet_balance: true, is_frozen: true, is_active: true, expires_at: true } },
        parent: { select: { first_name: true, last_name: true, phone: true, email: true } },
      },
    });
    if (!student) return res.status(404).json({ success: false, message: 'Student profile not found' });
    res.json({ success: true, data: student });
  } catch (err) { next(err); }
}

module.exports = { create, list, getOne, fullProfile, update, remove, myProfile };
