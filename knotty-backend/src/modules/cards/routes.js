const router = require('express').Router();
const ctrl = require('./controller');
const { authenticate } = require('../../middleware/auth');
const { authorize } = require('../../middleware/rbac');

router.get('/', authenticate, authorize('ADMIN', 'BURSAR', 'TEACHER', 'CANTEEN', 'DISCIPLINE'), ctrl.list);
router.get('/me/secure-qr', authenticate, authorize('STUDENT'), ctrl.mySecureQR);
router.get('/nfc/:nfcUid', authenticate, ctrl.scanNFC);
router.get('/:cardNumber/scan', authenticate, ctrl.scan);
router.post('/issue/:studentId', authenticate, authorize('ADMIN', 'TEACHER'), ctrl.issue);
router.put('/:id/freeze', authenticate, authorize('ADMIN'), ctrl.freeze);
router.put('/:id/unfreeze', authenticate, authorize('ADMIN'), ctrl.unfreeze);
router.put('/:id/nfc', authenticate, authorize('ADMIN'), ctrl.linkNFC);
router.post('/:id/top-up', authenticate, authorize('ADMIN', 'BURSAR'), ctrl.topUp);
router.post('/:id/top-up-cash', authenticate, authorize('ADMIN', 'BURSAR'), ctrl.cashTopUp);
router.get('/:id/transactions', authenticate, authorize('ADMIN', 'BURSAR', 'PARENT'), ctrl.transactions);
// Webhook — validated by shared secret header set in MTN MoMo developer portal callback config
router.post('/webhook/momo/:referenceId', (req, res, next) => {
  const secret = process.env.MOMO_WEBHOOK_SECRET;
  if (!secret) return res.status(401).json({ success: false, message: 'Webhook not configured' });
  const provided = req.headers['x-callback-secret'] || req.headers['x-mtn-signature'];
  if (provided !== secret) return res.status(401).json({ success: false, message: 'Webhook secret mismatch' });
  next();
}, ctrl.momoWebhook);

module.exports = router;
