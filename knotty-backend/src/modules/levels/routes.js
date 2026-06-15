const router = require('express').Router();
const ctrl = require('./controller');
const { authenticate } = require('../../middleware/auth');
const { authorize } = require('../../middleware/rbac');

const { checkClassAccess } = require('../../middleware/classAccess');

router.use(authenticate);
router.post('/levels', authorize('ADMIN'), ctrl.createLevel);
router.get('/levels', ctrl.getLevels);
router.delete('/levels/:id', authorize('ADMIN'), ctrl.deleteLevel);
router.post('/classes', authorize('ADMIN'), ctrl.createClass);
router.get('/classes', ctrl.getClasses);
router.delete('/classes/:id', authorize('ADMIN'), ctrl.deleteClass);
router.get('/classes/:id/students', checkClassAccess, ctrl.classStudents);
router.get('/staff', authorize('ADMIN'), ctrl.getStaff);
router.post('/staff', authorize('ADMIN', 'TEACHER'), ctrl.createStaff);
router.put('/staff/:id/toggle', authorize('ADMIN'), ctrl.toggleStaffActive);

module.exports = router;
