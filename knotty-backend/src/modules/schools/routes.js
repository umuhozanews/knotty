const router = require('express').Router();
const ctrl = require('./controller');
const { authenticate } = require('../../middleware/auth');
const { authorize } = require('../../middleware/rbac');

// Public/Admin list all schools in the multi-school system
router.get('/', authenticate, ctrl.listAll);

// Switch active school context
router.post('/switch', authenticate, authorize('ADMIN'), ctrl.switchSchool);

// Create a new school
router.post('/', authenticate, authorize('ADMIN'), ctrl.create);

router.get('/settings/attendance', authenticate, ctrl.getAttendanceSettings);
router.put('/settings/attendance', authenticate, authorize('ADMIN'), ctrl.updateAttendanceSettings);

router.get('/:id', authenticate, ctrl.getOne);
router.put('/:id', authenticate, authorize('ADMIN'), ctrl.update);
router.get('/:id/dashboard-stats', authenticate, ctrl.dashboardStats);
router.get('/:id/attendance-trend', authenticate, ctrl.attendanceTrend);

module.exports = router;
