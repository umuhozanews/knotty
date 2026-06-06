const router = require('express').Router();
const ctrl = require('./controller');
const { authenticate } = require('../../middleware/auth');
const { authorize } = require('../../middleware/rbac');

router.use(authenticate);
router.post('/', authorize('ADMIN', 'TEACHER'), ctrl.create);
router.get('/student/:studentId', ctrl.list);

module.exports = router;
