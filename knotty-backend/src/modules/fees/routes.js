const router = require('express').Router();
const ctrl = require('./controller');
const { authenticate } = require('../../middleware/auth');
const { authorize } = require('../../middleware/rbac');

router.post('/pay', authenticate, authorize('ADMIN', 'BURSAR'), ctrl.pay);
router.get('/verify/:momoReference', ctrl.verify); // webhook
router.get('/student/:studentId', authenticate, authorize('ADMIN', 'BURSAR', 'PARENT', 'STUDENT'), ctrl.studentFees);
router.get('/report', authenticate, authorize('ADMIN', 'BURSAR'), ctrl.schoolReport);

module.exports = router;
