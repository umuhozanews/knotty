const router = require('express').Router();
const ctrl = require('./controller');
const { authenticate } = require('../../middleware/auth');
const { authorize } = require('../../middleware/rbac');

router.use(authenticate);
router.post('/', authorize('ADMIN', 'NURSE'), ctrl.create);
router.get('/student/:studentId', authorize('ADMIN', 'NURSE', 'PARENT'), ctrl.list);
router.put('/:id', authorize('ADMIN', 'NURSE'), ctrl.update);
router.delete('/:id', authorize('ADMIN', 'NURSE'), ctrl.remove);

module.exports = router;
