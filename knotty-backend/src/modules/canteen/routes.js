const router = require('express').Router();
const ctrl = require('./controller');
const { authenticate } = require('../../middleware/auth');
const { authorize } = require('../../middleware/rbac');

router.use(authenticate);
router.post('/purchase', authorize('ADMIN', 'CANTEEN'), ctrl.purchase);
router.get('/transactions/:studentId', authorize('ADMIN', 'PARENT'), ctrl.studentTransactions);
router.get('/report', authorize('ADMIN', 'CANTEEN'), ctrl.dailyReport);

module.exports = router;
