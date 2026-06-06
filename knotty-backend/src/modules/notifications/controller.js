const service = require('./service');

async function list(req, res, next) {
  try {
    const { page = 1, limit = 20 } = req.query;
    const result = await service.getForUser(req.user.id, { page, limit });
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
}

async function markRead(req, res, next) {
  try {
    await service.markRead(req.params.id, req.user.id);
    res.json({ success: true, message: 'Marked as read' });
  } catch (err) { next(err); }
}

async function send(req, res, next) {
  try {
    const result = await service.broadcast({ ...req.body, school_id: req.user.school_id });
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
}

module.exports = { list, markRead, send };
