const router = require('express').Router();
const ctrl = require('./controller');
const { authenticate } = require('../../middleware/auth');
const { authorize } = require('../../middleware/rbac');
const validate = require('../../middleware/validator');
const { createStudentSchema, updateStudentSchema } = require('./validation');

router.use(authenticate);

// Student self-service — must come before /:id
router.get('/me/profile', authorize('STUDENT'), ctrl.myProfile);

router.post('/', authorize('ADMIN'), validate(createStudentSchema), ctrl.create);
router.get('/', authorize('ADMIN', 'TEACHER', 'NURSE', 'BURSAR', 'DISCIPLINE'), ctrl.list);
router.get('/:id', authorize('ADMIN', 'TEACHER', 'NURSE', 'BURSAR', 'DISCIPLINE', 'PARENT', 'STUDENT'), ctrl.getOne);
router.get('/:id/full-profile', authorize('ADMIN', 'TEACHER'), ctrl.fullProfile);
router.put('/:id', authorize('ADMIN'), validate(updateStudentSchema), ctrl.update);
router.delete('/:id', authorize('ADMIN'), ctrl.remove);

module.exports = router;
