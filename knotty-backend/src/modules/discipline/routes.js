const router = require('express').Router();
const ctrl = require('./controller');
const { authenticate } = require('../../middleware/auth');
const { authorize } = require('../../middleware/rbac');

router.use(authenticate);
router.get('/school', authorize('ADMIN', 'TEACHER', 'DISCIPLINE'), ctrl.listSchool);
router.post('/', authorize('ADMIN', 'TEACHER', 'DISCIPLINE'), ctrl.create);
router.get('/student/:studentId', authorize('ADMIN', 'TEACHER', 'DISCIPLINE', 'PARENT', 'STUDENT'), ctrl.list);
router.put('/:id', authorize('ADMIN', 'TEACHER', 'DISCIPLINE'), ctrl.update);

module.exports = router;
