const router = require('express').Router();
const ctrl = require('./controller');
const { authenticate } = require('../../middleware/auth');
const { authorize } = require('../../middleware/rbac');

router.use(authenticate);
router.get('/', authorize('ADMIN', 'DISCIPLINE', 'BURSAR', 'TEACHER', 'NURSE', 'LIBRARIAN'), ctrl.list);
router.get('/:id', authorize('ADMIN', 'DISCIPLINE', 'BURSAR', 'TEACHER', 'NURSE', 'LIBRARIAN'), ctrl.getOne);
router.post('/', authorize('ADMIN'), ctrl.create);
router.put('/:id', authorize('ADMIN'), ctrl.update);

module.exports = router;
