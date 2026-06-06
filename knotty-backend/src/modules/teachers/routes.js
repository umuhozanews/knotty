const router = require('express').Router();
const ctrl = require('./controller');
const { authenticate } = require('../../middleware/auth');
const { authorize } = require('../../middleware/rbac');

router.use(authenticate, authorize('ADMIN'));
router.post('/', ctrl.create);
router.get('/', ctrl.list);
router.get('/:id', ctrl.getOne);
router.put('/:id', ctrl.update);

module.exports = router;
