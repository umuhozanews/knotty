const service = require('./service');

async function create(req, res, next) {
  try {
    const teacher = await service.create(req.body, req.user.school_id);
    res.status(201).json({ success: true, data: teacher });
  } catch (err) { next(err); }
}

async function list(req, res, next) {
  try {
    const { page = 1, limit = 20 } = req.query;
    const result = await service.list(req.user.school_id, { page, limit });
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
}

async function getOne(req, res, next) {
  try {
    const teacher = await service.getOne(req.params.id, req.user.school_id);
    res.json({ success: true, data: teacher });
  } catch (err) { next(err); }
}

async function update(req, res, next) {
  try {
    const teacher = await service.update(req.params.id, req.user.school_id, req.body);
    res.json({ success: true, data: teacher });
  } catch (err) { next(err); }
}

module.exports = { create, list, getOne, update };
