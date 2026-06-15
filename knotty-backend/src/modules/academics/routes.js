const router = require('express').Router();
const ctrl = require('./controller');
const { authenticate } = require('../../middleware/auth');
const { authorize } = require('../../middleware/rbac');

router.use(authenticate);

// Terms
router.get('/terms', authorize('ADMIN', 'TEACHER', 'STUDENT', 'PARENT'), ctrl.listTerms);
router.post('/terms', authorize('ADMIN'), ctrl.createTerm);
router.put('/terms/:id', authorize('ADMIN'), ctrl.updateTerm);
router.delete('/terms/:id', authorize('ADMIN'), ctrl.deleteTerm);

// Programs
router.get('/programs', authorize('ADMIN', 'TEACHER', 'STUDENT', 'PARENT'), ctrl.listPrograms);
router.post('/programs', authorize('ADMIN'), ctrl.createProgram);
router.put('/programs/:id', authorize('ADMIN'), ctrl.updateProgram);
router.delete('/programs/:id', authorize('ADMIN'), ctrl.deleteProgram);

// Class Sections
router.get('/sections', authorize('ADMIN', 'TEACHER', 'STUDENT', 'PARENT'), ctrl.listSections);
router.post('/sections', authorize('ADMIN'), ctrl.createSection);
router.get('/sections/:id', authorize('ADMIN', 'TEACHER', 'STUDENT', 'PARENT'), ctrl.getSectionDetails);

// Enrollments
router.post('/enroll', authorize('ADMIN'), ctrl.enroll);
router.delete('/enrollments/:enrollmentId', authorize('ADMIN'), ctrl.unenroll);

// Timetable
router.get('/timetable', authorize('ADMIN', 'TEACHER', 'STUDENT', 'PARENT'), ctrl.listTimetable);
router.post('/timetable', authorize('ADMIN'), ctrl.createTimetableEntry);
router.delete('/timetable/:id', authorize('ADMIN'), ctrl.deleteTimetableEntry);

// Exams
router.get('/exams', authorize('ADMIN', 'TEACHER', 'STUDENT', 'PARENT'), ctrl.listExams);
router.post('/exams', authorize('ADMIN', 'TEACHER'), ctrl.createExam);
router.delete('/exams/:id', authorize('ADMIN', 'TEACHER'), ctrl.deleteExam);

// Grading Scale
router.get('/grading-scale', authorize('ADMIN', 'TEACHER', 'STUDENT', 'PARENT'), ctrl.getGradingScale);
router.post('/grading-scale', authorize('ADMIN'), ctrl.saveGradingScale);

// Exam Results
router.get('/exams/:examId/results', authorize('ADMIN', 'TEACHER', 'STUDENT', 'PARENT'), ctrl.listExamResults);
router.post('/exams/:examId/results', authorize('ADMIN', 'TEACHER'), ctrl.recordExamResults);
router.post('/exams/results/:resultId/approve', authorize('ADMIN', 'TEACHER'), ctrl.approveExamResult);

module.exports = router;
