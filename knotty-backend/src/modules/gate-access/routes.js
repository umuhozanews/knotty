const router = require('express').Router();
const ctrl = require('./controller');
const { authenticate } = require('../../middleware/auth');
const { authorize } = require('../../middleware/rbac');

router.use(authenticate);

// Campuses
router.get('/campuses', authorize('ADMIN', 'TEACHER', 'STUDENT', 'PARENT', 'DISCIPLINE'), ctrl.listCampuses);
router.post('/campuses', authorize('ADMIN'), ctrl.createCampus);

// Gate Devices
router.get('/devices', authorize('ADMIN', 'DISCIPLINE'), ctrl.listGateDevices);
router.post('/devices', authorize('ADMIN'), ctrl.createGateDevice);
router.put('/devices/:id', authorize('ADMIN'), ctrl.updateGateDevice);
router.delete('/devices/:id', authorize('ADMIN'), ctrl.deleteGateDevice);

// Restricted Zones & Grants
router.get('/zones', authorize('ADMIN', 'DISCIPLINE'), ctrl.listRestrictedZones);
router.post('/zones', authorize('ADMIN'), ctrl.createRestrictedZone);
router.put('/zones/:id', authorize('ADMIN'), ctrl.updateRestrictedZone);
router.delete('/zones/:id', authorize('ADMIN'), ctrl.deleteRestrictedZone);

router.post('/zones/:zoneId/grants', authorize('ADMIN'), ctrl.createZoneAccessGrant);
router.delete('/grants/:id', authorize('ADMIN'), ctrl.deleteZoneAccessGrant);

// Evaluate gate/NFC card tap (ADMIN or DISCIPLINE officer at gate terminals)
router.post('/evaluate', authorize('ADMIN', 'DISCIPLINE'), ctrl.evaluateAccess);
router.post('/override/:logId', authorize('ADMIN'), ctrl.manualAccessOverride);

// Visitors
router.get('/visitors', authorize('ADMIN', 'DISCIPLINE'), ctrl.listVisitorLogs);
router.post('/visitors', authorize('ADMIN', 'DISCIPLINE'), ctrl.createVisitorLog);
router.post('/visitors/:id/checkout', authorize('ADMIN', 'DISCIPLINE'), ctrl.checkoutVisitorLog);

// Access Logs
router.get('/logs', authorize('ADMIN', 'DISCIPLINE'), ctrl.listAccessLogs);

module.exports = router;
