const router = require('express').Router();
const ctrl = require('./controller');
const { authenticate } = require('../../middleware/auth');
const { authorize } = require('../../middleware/rbac');

router.post('/', ctrl.create);
router.get('/:id', authenticate, ctrl.getOne);
router.put('/:id', authenticate, authorize('ADMIN'), ctrl.update);
router.get('/:id/dashboard-stats', authenticate, ctrl.dashboardStats);
router.get('/:id/attendance-trend', authenticate, ctrl.attendanceTrend);
router.get('/settings/attendance', authenticate, ctrl.getAttendanceSettings);
router.put('/settings/attendance', authenticate, authorize('ADMIN'), ctrl.updateAttendanceSettings);

module.exports = router;
