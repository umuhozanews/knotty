const router = require('express').Router();
const ctrl = require('./controller');
const { authenticate } = require('../../middleware/auth');
const { authorize } = require('../../middleware/rbac');

router.use(authenticate);

// Verify momo payment status (authenticated — client polls this)
router.get('/verify/:momoReference', ctrl.verify);

// Legacy
router.post('/pay', authorize('ADMIN', 'BURSAR'), ctrl.pay);
router.get('/student/:studentId', authorize('ADMIN', 'BURSAR', 'PARENT', 'STUDENT'), ctrl.studentFees);
router.get('/report', authorize('ADMIN', 'BURSAR'), ctrl.schoolReport);

// Fee Structures
router.get('/structures', authorize('ADMIN', 'BURSAR'), ctrl.listStructures);
router.post('/structures', authorize('ADMIN', 'BURSAR'), ctrl.createStructure);
router.delete('/structures/:id', authorize('ADMIN', 'BURSAR'), ctrl.deleteStructure);

// Invoices
router.get('/invoices', authorize('ADMIN', 'BURSAR', 'STUDENT', 'PARENT'), ctrl.listInvoices);
router.post('/invoices/generate', authorize('ADMIN', 'BURSAR'), ctrl.generateInvoices);
router.post('/invoices/pay', authorize('ADMIN', 'BURSAR', 'STUDENT', 'PARENT'), ctrl.payInvoice);

// Refunds
router.get('/refunds', authorize('ADMIN', 'BURSAR'), ctrl.listRefunds);
router.post('/refunds', authorize('ADMIN', 'BURSAR'), ctrl.requestRefund);
router.post('/refunds/:id/resolve', authorize('ADMIN', 'BURSAR'), ctrl.resolveRefund);

module.exports = router;
