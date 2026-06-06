const service = require('./service');

async function purchase(req, res, next) {
  try {
    const result = await service.purchase({ ...req.body, served_by: req.user.id, school_id: req.user.school_id });
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
}

async function studentTransactions(req, res, next) {
  try {
    const { page = 1, limit = 20 } = req.query;
    const result = await service.getStudentTransactions(req.params.studentId, { page, limit });
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
}

async function dailyReport(req, res, next) {
  try {
    const result = await service.getDailyReport(req.user.school_id, req.query.date);
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
}

module.exports = { purchase, studentTransactions, dailyReport };
