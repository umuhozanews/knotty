const router = require('express').Router();
const ctrl = require('./controller');
const { authenticate } = require('../../middleware/auth');
const { authorize } = require('../../middleware/rbac');
const validate = require('../../middleware/validator');
const { createStudentSchema, updateStudentSchema } = require('./validation');

router.use(authenticate);

// Student self-service — must come before /:id
router.get('/me/profile', authorize('STUDENT'), ctrl.myProfile);
router.get('/parent/me', authorize('PARENT'), ctrl.parentChildren);

router.post('/', authorize('ADMIN', 'TEACHER'), validate(createStudentSchema), ctrl.create);
router.get('/', authorize('ADMIN', 'TEACHER', 'NURSE', 'BURSAR', 'DISCIPLINE'), ctrl.list);
router.get('/:id', authorize('ADMIN', 'TEACHER', 'NURSE', 'BURSAR', 'DISCIPLINE', 'PARENT', 'STUDENT'), ctrl.getOne);
router.get('/:id/full-profile', authorize('ADMIN', 'TEACHER'), ctrl.fullProfile);
router.put('/:id', authorize('ADMIN', 'TEACHER', 'PARENT', 'STUDENT'), validate(updateStudentSchema), ctrl.update);
router.delete('/:id', authorize('ADMIN', 'TEACHER'), ctrl.remove);

module.exports = router;
