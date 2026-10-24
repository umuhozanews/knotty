const router = require('express').Router();
const ctrl = require('./controller');
const { authenticate } = require('../../middleware/auth');
const { authorize } = require('../../middleware/rbac');

router.use(authenticate);

router.get('/', authorize('ADMIN', 'BURSAR', 'DISCIPLINE', 'TEACHER', 'NURSE', 'LIBRARIAN'), ctrl.list);
router.post('/', authorize('ADMIN'), ctrl.create);
router.get('/:id', authorize('ADMIN', 'BURSAR', 'DISCIPLINE', 'TEACHER', 'NURSE', 'LIBRARIAN'), ctrl.getOne);
router.put('/:id', authorize('ADMIN'), ctrl.update);
router.delete('/:id', authorize('ADMIN'), ctrl.remove);

module.exports = router;
