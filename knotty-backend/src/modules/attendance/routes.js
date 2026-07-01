const router = require('express').Router();
const ctrl = require('./controller');
const { authenticate } = require('../../middleware/auth');
const { authorize } = require('../../middleware/rbac');

const { checkClassAccess } = require('../../middleware/classAccess');

router.use(authenticate);

router.post('/scan', authorize('ADMIN', 'TEACHER', 'DISCIPLINE'), ctrl.scan);
router.post('/scan-nfc', authorize('ADMIN', 'TEACHER', 'DISCIPLINE'), ctrl.scanNFC);
router.post('/scan-secure', authorize('ADMIN', 'TEACHER', 'DISCIPLINE'), ctrl.scanSecure);
router.post('/bulk', authorize('ADMIN', 'TEACHER'), checkClassAccess, ctrl.bulk);
router.get('/today-summary', authorize('ADMIN', 'TEACHER', 'DISCIPLINE'), checkClassAccess, ctrl.todaySummary);
router.get('/me', authorize('STUDENT'), ctrl.myAttendance);
router.get('/student/:studentId', authorize('ADMIN', 'TEACHER', 'DISCIPLINE', 'PARENT', 'STUDENT'), ctrl.student);
router.get('/class/:classId', authorize('ADMIN', 'TEACHER'), checkClassAccess, ctrl.byClass);
router.get('/report/:studentId', authorize('ADMIN', 'TEACHER', 'DISCIPLINE', 'PARENT', 'STUDENT'), ctrl.report);
router.get('/pdf/:classId', authorize('ADMIN', 'TEACHER'), checkClassAccess, ctrl.pdfByClass);

module.exports = router;
