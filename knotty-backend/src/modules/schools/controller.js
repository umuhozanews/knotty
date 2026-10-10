const service = require('./service');

async function listAll(req, res, next) {
  try {
    const schools = await service.listAllSchools(req.user.id);
    res.json({ success: true, data: schools });
  } catch (err) { next(err); }
}

async function createOrganization(req, res, next) {
  try {
    const prisma = require('../../config/database');
    const platform = await prisma.platformMembership.findFirst({ where: { user_id: req.user.id, status: 'ACTIVE' } });
    if (!platform) return res.status(403).json({ success: false, message: 'Platform administrator access required' });
    const organization = await service.createOrganization(req.body || {});
    res.status(201).json({ success: true, data: organization });
  } catch (err) { next(err); }
}

async function setOrganizationManager(req, res, next) {
  try {
    const prisma = require('../../config/database');
    const platform = await prisma.platformMembership.findFirst({ where: { user_id: req.user.id, status: 'ACTIVE' } });
    if (!platform) return res.status(403).json({ success: false, message: 'Platform administrator access required' });
    const { user_id } = req.body || {};
    if (!user_id) return res.status(400).json({ success: false, message: 'user_id is required' });
    const membership = await service.setOrganizationManager(req.params.organizationId, user_id);
    res.status(201).json({ success: true, data: membership });
  } catch (err) { next(err); }
}

async function attachSchoolToOrganization(req, res, next) {
  try {
    const prisma = require('../../config/database');
    const platform = await prisma.platformMembership.findFirst({ where: { user_id: req.user.id, status: 'ACTIVE' } });
    if (!platform) return res.status(403).json({ success: false, message: 'Platform administrator access required' });
    const school = await service.attachSchoolToOrganization(req.params.organizationId, req.params.schoolId, req.body?.branch_code);
    res.json({ success: true, data: school });
  } catch (err) { next(err); }
}

async function switchSchool(req, res, next) {
  try {
    const { school_id } = req.body;
    if (!school_id) {
      return res.status(400).json({ success: false, message: 'Target school_id is required' });
    }
    const result = await service.switchSchool(req.user.id, school_id, req.user.session_id);
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
}

async function create(req, res, next) {
  try {
    const prisma = require('../../config/database');
    const platform = await prisma.platformMembership.findFirst({ where: { user_id: req.user.id, status: 'ACTIVE' } });
    let data = { ...req.body };
    if (!platform && req.user.role === 'ORGANIZATION_MANAGER') {
      const orgMembership = await prisma.organizationMembership.findFirst({
        where: { user_id: req.user.id, status: 'ACTIVE', role: 'ORGANIZATION_MANAGER' },
        select: { organization_id: true },
      });
      if (!orgMembership) return res.status(403).json({ success: false, message: 'Organization manager access required' });
      if (data.organization_id && data.organization_id !== orgMembership.organization_id) {
        return res.status(403).json({ success: false, message: 'Cannot create a school under another organization' });
      }
      data.organization_id = orgMembership.organization_id;
    } else if (!platform && req.user.role !== 'PLATFORM_ADMIN') {
      return res.status(403).json({ success: false, message: 'Only platform or organization managers can create schools' });
    }
    const school = await service.createSchool(data);
    res.status(201).json({ success: true, data: school });
  } catch (err) { next(err); }
}

async function getOne(req, res, next) {
  try {
    if (!await service.canAccessSchool(req.user.id, req.params.id)) return res.status(403).json({ success: false, message: 'School access denied' });
    const school = await service.getSchool(req.params.id);
    res.json({ success: true, data: school });
  } catch (err) { next(err); }
}

async function update(req, res, next) {
  try {
    if (!await service.canAccessSchool(req.user.id, req.params.id)) return res.status(403).json({ success: false, message: 'School access denied' });
    const school = await service.updateSchool(req.params.id, req.body);
    res.json({ success: true, data: school });
  } catch (err) { next(err); }
}

async function dashboardStats(req, res, next) {
  try {
    if (!await service.canAccessSchool(req.user.id, req.params.id)) return res.status(403).json({ success: false, message: 'School access denied' });
    const stats = await service.getDashboardStats(req.params.id);
    res.json({ success: true, data: stats });
  } catch (err) { next(err); }
}

async function attendanceTrend(req, res, next) {
  try {
    if (!await service.canAccessSchool(req.user.id, req.params.id)) return res.status(403).json({ success: false, message: 'School access denied' });
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

async function listMemberships(req, res, next) {
  try {
    if (!await service.canAccessSchool(req.user.id, req.params.id)) return res.status(403).json({ success: false, message: 'School access denied' });
    const memberships = await service.listMemberships(req.params.id);
    res.json({ success: true, data: memberships });
  } catch (err) { next(err); }
}

async function addMembership(req, res, next) {
  try {
    if (!await service.canAccessSchool(req.user.id, req.params.id)) return res.status(403).json({ success: false, message: 'School access denied' });
    const { user_id, role } = req.body || {};
    if (!user_id || !role) return res.status(400).json({ success: false, message: 'user_id and role are required' });
    const membership = await service.addMembership(req.params.id, user_id, role);
    res.status(201).json({ success: true, data: membership });
  } catch (err) { next(err); }
}

async function revokeMembership(req, res, next) {
  try {
    if (!await service.canAccessSchool(req.user.id, req.params.id)) return res.status(403).json({ success: false, message: 'School access denied' });
    const membership = await service.revokeMembership(req.params.id, req.params.membershipId, req.user.id);
    res.json({ success: true, data: membership });
  } catch (err) { next(err); }
}

module.exports = {
  listAll,
  createOrganization,
  setOrganizationManager,
  attachSchoolToOrganization,
  switchSchool,
  create,
  getOne,
  update,
  dashboardStats,
  attendanceTrend,
  updateAttendanceSettings,
  getAttendanceSettings,
  listMemberships,
  addMembership,
  revokeMembership,
};
