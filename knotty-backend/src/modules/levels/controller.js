const service = require('./service');

async function createLevel(req, res, next) {
  try {
    const level = await service.createLevel(req.body, req.user.school_id);
    res.status(201).json({ success: true, data: level });
  } catch (err) { next(err); }
}

async function getLevels(req, res, next) {
  try {
    const data = await service.getLevels(req.user.school_id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

async function deleteLevel(req, res, next) {
  try {
    await service.deleteLevel(req.params.id, req.user.school_id);
    res.json({ success: true, message: 'Level deleted' });
  } catch (err) { next(err); }
}

async function createClass(req, res, next) {
  try {
    const cls = await service.createClass(req.body, req.user.school_id);
    res.status(201).json({ success: true, data: cls });
  } catch (err) { next(err); }
}

async function getClasses(req, res, next) {
  try {
    const data = await service.getClasses(req.user.school_id, req.user);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

async function deleteClass(req, res, next) {
  try {
    await service.deleteClass(req.params.id, req.user.school_id);
    res.json({ success: true, message: 'Class deleted' });
  } catch (err) { next(err); }
}

async function classStudents(req, res, next) {
  try {
    const data = await service.getClassStudents(req.params.id, req.user.school_id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

async function getStaff(req, res, next) {
  try {
    const data = await service.getStaff(req.user.school_id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

async function createStaff(req, res, next) {
  try {
    if (req.user.role === 'TEACHER' && req.body.role !== 'PARENT') {
      return res.status(403).json({ success: false, message: 'Teachers can only create parent accounts' });
    }
    const user = await service.createStaff(req.body, req.user.school_id);
    res.status(201).json({ success: true, data: user });
  } catch (err) { next(err); }
}

async function toggleStaffActive(req, res, next) {
  try {
    if (req.params.id === req.user.id) {
      return res.status(400).json({ success: false, message: 'You cannot deactivate your own account to prevent accidental lockout.' });
    }
    const result = await service.toggleStaffActive(req.params.id, req.user.school_id);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
}

module.exports = { createLevel, getLevels, deleteLevel, createClass, getClasses, deleteClass, classStudents, getStaff, createStaff, toggleStaffActive };
