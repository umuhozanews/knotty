const service = require('./service');

async function list(req, res, next) {
  try {
    const { page, limit, role, search, status } = req.query;
    const result = await service.list(req.user.school_id, { page, limit, role, search, status });
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
}

async function create(req, res, next) {
  try {
    const worker = await service.create(req.body, req.user.school_id);
    res.status(201).json({ success: true, data: worker });
  } catch (err) { next(err); }
}

async function getOne(req, res, next) {
  try {
    const worker = await service.getOne(req.params.id, req.user.school_id);
    res.json({ success: true, data: worker });
  } catch (err) { next(err); }
}

async function update(req, res, next) {
  try {
    const worker = await service.update(req.params.id, req.user.school_id, req.body);
    res.json({ success: true, data: worker });
  } catch (err) { next(err); }
}

async function remove(req, res, next) {
  try {
    const result = await service.remove(req.params.id, req.user.school_id);
    res.json(result);
  } catch (err) { next(err); }
}

module.exports = { list, create, getOne, update, remove };
