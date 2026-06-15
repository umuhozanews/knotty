const service = require('./service');

async function listCampuses(req, res, next) {
  try {
    const result = await service.listCampuses(req.user.school_id);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
}

async function createCampus(req, res, next) {
  try {
    const result = await service.createCampus(req.user.school_id, req.body);
    res.status(201).json({ success: true, data: result });
  } catch (err) { next(err); }
}

async function listGateDevices(req, res, next) {
  try {
    const { campusId } = req.query;
    const result = await service.listGateDevices(req.user.school_id, { campusId });
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
}

async function createGateDevice(req, res, next) {
  try {
    const result = await service.createGateDevice(req.user.school_id, req.body);
    res.status(201).json({ success: true, data: result });
  } catch (err) { next(err); }
}

async function updateGateDevice(req, res, next) {
  try {
    const result = await service.updateGateDevice(req.params.id, req.user.school_id, req.body);
    res.json({ success: true, data: result, message: 'Gate device updated successfully' });
  } catch (err) { next(err); }
}

async function deleteGateDevice(req, res, next) {
  try {
    await service.deleteGateDevice(req.params.id, req.user.school_id);
    res.json({ success: true, message: 'Gate device deleted successfully' });
  } catch (err) { next(err); }
}

async function listRestrictedZones(req, res, next) {
  try {
    const result = await service.listRestrictedZones(req.user.school_id);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
}

async function createRestrictedZone(req, res, next) {
  try {
    const result = await service.createRestrictedZone(req.user.school_id, req.body);
    res.status(201).json({ success: true, data: result });
  } catch (err) { next(err); }
}

async function updateRestrictedZone(req, res, next) {
  try {
    const result = await service.updateRestrictedZone(req.params.id, req.user.school_id, req.body);
    res.json({ success: true, data: result, message: 'Restricted zone updated successfully' });
  } catch (err) { next(err); }
}

async function deleteRestrictedZone(req, res, next) {
  try {
    await service.deleteRestrictedZone(req.params.id, req.user.school_id);
    res.json({ success: true, message: 'Restricted zone deleted successfully' });
  } catch (err) { next(err); }
}

async function createZoneAccessGrant(req, res, next) {
  try {
    const result = await service.createZoneAccessGrant(req.user.school_id, req.params.zoneId, req.body);
    res.status(201).json({ success: true, data: result });
  } catch (err) { next(err); }
}

async function deleteZoneAccessGrant(req, res, next) {
  try {
    await service.deleteZoneAccessGrant(req.params.id, req.user.school_id);
    res.json({ success: true, message: 'Access grant deleted successfully' });
  } catch (err) { next(err); }
}

async function evaluateAccess(req, res, next) {
  try {
    const result = await service.evaluateAccess(req.user.school_id, req.body);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
}

async function manualAccessOverride(req, res, next) {
  try {
    const result = await service.manualAccessOverride(req.user.school_id, {
      logId: req.params.logId,
      overriddenByUserId: req.user.id,
    });
    res.json({ success: true, data: result, message: 'Access override approved' });
  } catch (err) { next(err); }
}

async function createVisitorLog(req, res, next) {
  try {
    const { campusId } = req.body;
    const result = await service.createVisitorLog(req.user.school_id, campusId, req.body);
    res.status(201).json({ success: true, data: result });
  } catch (err) { next(err); }
}

async function checkoutVisitorLog(req, res, next) {
  try {
    const result = await service.checkoutVisitorLog(req.params.id, req.user.school_id);
    res.json({ success: true, data: result, message: 'Visitor checked out successfully' });
  } catch (err) { next(err); }
}

async function listVisitorLogs(req, res, next) {
  try {
    const { campusId, page = 1, limit = 20 } = req.query;
    const result = await service.listVisitorLogs(req.user.school_id, {
      campusId,
      page: Number(page),
      limit: Number(limit)
    });
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
}

async function listAccessLogs(req, res, next) {
  try {
    const { page = 1, limit = 30, decision, direction, deviceId } = req.query;
    const result = await service.listAccessLogs(req.user.school_id, {
      page: Number(page),
      limit: Number(limit),
      decision,
      direction,
      deviceId,
    });
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
}

module.exports = {
  listCampuses,
  createCampus,
  listGateDevices,
  createGateDevice,
  updateGateDevice,
  deleteGateDevice,
  listRestrictedZones,
  createRestrictedZone,
  updateRestrictedZone,
  deleteRestrictedZone,
  createZoneAccessGrant,
  deleteZoneAccessGrant,
  evaluateAccess,
  manualAccessOverride,
  createVisitorLog,
  checkoutVisitorLog,
  listVisitorLogs,
  listAccessLogs,
};
