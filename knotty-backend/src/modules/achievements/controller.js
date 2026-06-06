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
    const result = await service.list(req.params.studentId, { page, limit });
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
}

module.exports = { create, list };
