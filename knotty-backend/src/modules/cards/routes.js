const router = require('express').Router();
const ctrl = require('./controller');
const { authenticate } = require('../../middleware/auth');
const { authorize } = require('../../middleware/rbac');

router.get('/', authenticate, authorize('ADMIN'), ctrl.list);
router.get('/nfc/:nfcUid', authenticate, ctrl.scanNFC);
router.get('/:cardNumber/scan', authenticate, ctrl.scan);
router.post('/issue/:studentId', authenticate, authorize('ADMIN'), ctrl.issue);
router.put('/:id/freeze', authenticate, authorize('ADMIN'), ctrl.freeze);
router.put('/:id/unfreeze', authenticate, authorize('ADMIN'), ctrl.unfreeze);
router.put('/:id/nfc', authenticate, authorize('ADMIN'), ctrl.linkNFC);
router.post('/:id/top-up', authenticate, authorize('ADMIN', 'PARENT'), ctrl.topUp);
router.post('/:id/top-up-cash', authenticate, authorize('ADMIN'), ctrl.cashTopUp);
router.get('/:id/transactions', authenticate, authorize('ADMIN', 'PARENT'), ctrl.transactions);
router.post('/webhook/momo/:referenceId', ctrl.momoWebhook);

module.exports = router;
