const service = require('./service');

async function pay(req, res, next) {
  try {
    const result = await service.initiatePayment({ ...req.body, school_id: req.user.school_id });
    res.status(201).json({ success: true, ...result });
  } catch (err) { next(err); }
}

async function verify(req, res, next) {
  try {
    const payment = await service.verifyMomoPayment(req.params.momoReference);
    res.json({ success: true, data: payment });
  } catch (err) { next(err); }
}

async function studentFees(req, res, next) {
  try {
    const { page = 1, limit = 20 } = req.query;
    const result = await service.getStudentFees(req.params.studentId, { page, limit });
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
}

async function schoolReport(req, res, next) {
  try {
    const result = await service.getSchoolFeeReport(req.user.school_id);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
}

module.exports = { pay, verify, studentFees, schoolReport };
