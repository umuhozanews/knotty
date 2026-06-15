const service = require('./service');
const prisma = require('../../config/database');

// Compatibility functions
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

// Fee structures
async function listStructures(req, res, next) {
  try {
    const result = await service.listFeeStructures(req.user.school_id);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
}

async function createStructure(req, res, next) {
  try {
    const result = await service.createFeeStructure(req.user.school_id, req.body);
    res.status(201).json({ success: true, data: result });
  } catch (err) { next(err); }
}

async function deleteStructure(req, res, next) {
  try {
    await service.deleteFeeStructure(req.params.id, req.user.school_id);
    res.json({ success: true, message: 'Fee structure deleted successfully' });
  } catch (err) { next(err); }
}

// Invoices
async function listInvoices(req, res, next) {
  try {
    let { studentId, classSectionId, termId, status } = req.query;

    // Security check: restrict STUDENT/PARENT to their own records
    if (req.user.role === 'STUDENT') {
      const student = await prisma.student.findUnique({ where: { user_id: req.user.id } });
      studentId = student ? student.id : 'none';
    } else if (req.user.role === 'PARENT') {
      const children = await prisma.student.findMany({ where: { parent_id: req.user.id } });
      const childIds = children.map(c => c.id);
      if (studentId) {
        if (!childIds.includes(studentId)) studentId = 'none';
      } else {
        studentId = { in: childIds };
      }
    }

    const result = await service.listInvoices(req.user.school_id, { studentId, classSectionId, termId, status });
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
}

async function generateInvoices(req, res, next) {
  try {
    const result = await service.generateInvoices(req.user.school_id, req.body);
    res.status(201).json({ success: true, ...result, message: 'Invoices generated successfully' });
  } catch (err) { next(err); }
}

async function payInvoice(req, res, next) {
  try {
    const result = await service.payInvoice(req.user.school_id, req.user.id, req.body);
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
}

// Refunds
async function listRefunds(req, res, next) {
  try {
    const result = await service.listRefundRequests(req.user.school_id);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
}

async function requestRefund(req, res, next) {
  try {
    const result = await service.requestRefund(req.user.school_id, req.user.id, req.body);
    res.status(201).json({ success: true, data: result, message: 'Refund request submitted successfully' });
  } catch (err) { next(err); }
}

async function resolveRefund(req, res, next) {
  try {
    const result = await service.resolveRefund(req.user.school_id, req.user.id, req.params.id, req.body);
    res.json({ success: true, ...result, message: 'Refund request resolved successfully' });
  } catch (err) { next(err); }
}

module.exports = {
  pay,
  verify,
  studentFees,
  schoolReport,

  // New
  listStructures,
  createStructure,
  deleteStructure,
  listInvoices,
  generateInvoices,
  payInvoice,
  listRefunds,
  requestRefund,
  resolveRefund,
};
