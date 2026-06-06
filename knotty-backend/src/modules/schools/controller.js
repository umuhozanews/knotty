const service = require('./service');

async function create(req, res, next) {
  try {
    const school = await service.createSchool(req.body);
    res.status(201).json({ success: true, data: school });
  } catch (err) { next(err); }
}

async function getOne(req, res, next) {
  try {
    const school = await service.getSchool(req.params.id);
    res.json({ success: true, data: school });
  } catch (err) { next(err); }
}

async function update(req, res, next) {
  try {
    const school = await service.updateSchool(req.params.id, req.body);
    res.json({ success: true, data: school });
  } catch (err) { next(err); }
}

async function dashboardStats(req, res, next) {
  try {
    const stats = await service.getDashboardStats(req.params.id);
    res.json({ success: true, data: stats });
  } catch (err) { next(err); }
}

async function attendanceTrend(req, res, next) {
  try {
    const days = parseInt(req.query.days) || 9;
    const data = await service.getAttendanceTrend(req.params.id, days);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

async function updateAttendanceSettings(req, res, next) {
  try {
    const { tap_out_after_minutes, school_start_time } = req.body;
    const prisma = require('../../config/database');
    const updated = await prisma.school.update({
      where: { id: req.user.school_id },
      data: {
        ...(tap_out_after_minutes !== undefined && { tap_out_after_minutes: Number(tap_out_after_minutes) }),
        ...(school_start_time !== undefined && { school_start_time: String(school_start_time) }),
      },
      select: { tap_out_after_minutes: true, school_start_time: true },
    });
    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
}

async function getAttendanceSettings(req, res, next) {
  try {
    const prisma = require('../../config/database');
    const school = await prisma.school.findUnique({
      where: { id: req.user.school_id },
      select: { tap_out_after_minutes: true, school_start_time: true },
    });
    res.json({ success: true, data: school });
  } catch (err) { next(err); }
}

module.exports = { create, getOne, update, dashboardStats, attendanceTrend, updateAttendanceSettings, getAttendanceSettings };
