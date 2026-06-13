const router = require('express').Router();
const ctrl = require('./controller');
const { authenticate } = require('../../middleware/auth');
const { authorize } = require('../../middleware/rbac');

router.use(authenticate);
router.get('/', authorize('ADMIN', 'NURSE', 'TEACHER'), ctrl.listSchool);
router.post('/', authorize('ADMIN', 'NURSE', 'TEACHER'), ctrl.create);
router.get('/student/:studentId', authorize('ADMIN', 'NURSE', 'PARENT', 'TEACHER'), ctrl.list);
router.put('/:id', authorize('ADMIN', 'NURSE', 'TEACHER'), ctrl.update);
router.delete('/:id', authorize('ADMIN', 'NURSE', 'TEACHER'), ctrl.remove);

module.exports = router;
