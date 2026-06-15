const router = require('express').Router();
const ctrl = require('./controller');
const { authenticate } = require('../../middleware/auth');
const { authorize } = require('../../middleware/rbac');

router.use(authenticate);

// Incident Logs (Legacy/Direct Logs)
router.get('/', authorize('ADMIN', 'NURSE', 'TEACHER'), ctrl.listSchool);
router.post('/', authorize('ADMIN', 'NURSE', 'TEACHER'), ctrl.create);
router.get('/student/:studentId', authorize('ADMIN', 'NURSE', 'PARENT', 'TEACHER', 'STUDENT'), ctrl.list);
router.put('/:id', authorize('ADMIN', 'NURSE', 'TEACHER'), ctrl.update);
router.delete('/:id', authorize('ADMIN', 'NURSE', 'TEACHER'), ctrl.remove);

// Advanced Medical Profile
router.get('/profile/:studentId', authorize('ADMIN', 'NURSE', 'PARENT', 'STUDENT', 'TEACHER'), ctrl.getMedicalProfile);
router.put('/profile/:studentId', authorize('ADMIN', 'NURSE'), ctrl.upsertMedicalProfile);

// Immunizations
router.get('/immunization/:studentId', authorize('ADMIN', 'NURSE', 'PARENT', 'STUDENT', 'TEACHER'), ctrl.listImmunizations);
router.post('/immunization/:studentId', authorize('ADMIN', 'NURSE'), ctrl.addImmunizationRecord);
router.delete('/immunization/:id', authorize('ADMIN', 'NURSE'), ctrl.removeImmunizationRecord);

// Clinic Visits & Medications
router.get('/visits', authorize('ADMIN', 'NURSE'), ctrl.listAllClinicVisits);
router.get('/visits/student/:studentId', authorize('ADMIN', 'NURSE', 'PARENT', 'STUDENT'), ctrl.listClinicVisits);
router.post('/visits/student/:studentId', authorize('ADMIN', 'NURSE'), ctrl.createClinicVisit);

module.exports = router;
