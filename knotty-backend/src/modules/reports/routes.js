const router = require('express').Router();
const ctrl = require('./controller');
const { authenticate } = require('../../middleware/auth');
const { authorize } = require('../../middleware/rbac');

router.use(authenticate);
router.post('/', authorize('ADMIN', 'TEACHER'), ctrl.create);
router.get('/student/me', authorize('STUDENT'), ctrl.myReports);
router.get('/student/:studentId', authorize('ADMIN', 'TEACHER', 'PARENT'), ctrl.forStudent);
router.get('/:id', authorize('ADMIN', 'TEACHER', 'STUDENT', 'PARENT'), ctrl.getOne);
router.put('/:id', authorize('ADMIN', 'TEACHER'), ctrl.update);
router.post('/:id/publish', authorize('ADMIN', 'TEACHER'), ctrl.publish);
router.get('/:id/pdf', authorize('ADMIN', 'TEACHER', 'STUDENT', 'PARENT'), ctrl.pdf);

module.exports = router;
