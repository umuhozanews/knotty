const router = require('express').Router();
const ctrl = require('./controller');
const { authenticate } = require('../../middleware/auth');
const { authorize } = require('../../middleware/rbac');

router.use(authenticate);
router.get('/', ctrl.list);
router.put('/:id/read', ctrl.markRead);
router.post('/send', authorize('ADMIN'), ctrl.send);

module.exports = router;
