const service = require('./service');
const timetableGenerator = require('./timetable-generator');

// Terms
async function listTerms(req, res, next) {
  try {
    const result = await service.listAcademicTerms(req.user.school_id);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
}

async function createTerm(req, res, next) {
  try {
    const result = await service.createAcademicTerm(req.user.school_id, req.body);
    res.status(201).json({ success: true, data: result });
  } catch (err) { next(err); }
}

async function updateTerm(req, res, next) {
  try {
    const result = await service.updateAcademicTerm(req.params.id, req.user.school_id, req.body);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
}

async function deleteTerm(req, res, next) {
  try {
    await service.deleteAcademicTerm(req.params.id, req.user.school_id);
    res.json({ success: true, message: 'Academic term deleted successfully' });
  } catch (err) { next(err); }
}

// Programs
async function listPrograms(req, res, next) {
  try {
    const result = await service.listPrograms(req.user.school_id);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
}

async function createProgram(req, res, next) {
  try {
    const result = await service.createProgram(req.user.school_id, req.body);
    res.status(201).json({ success: true, data: result });
  } catch (err) { next(err); }
}

async function updateProgram(req, res, next) {
  try {
    const result = await service.updateProgram(req.params.id, req.user.school_id, req.body);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
}

async function deleteProgram(req, res, next) {
  try {
    await service.deleteProgram(req.params.id, req.user.school_id);
    res.json({ success: true, message: 'Program deleted successfully' });
  } catch (err) { next(err); }
}

// Sections
async function listSections(req, res, next) {
  try {
    const { campusId, programId, academicTermId } = req.query;
    const result = await service.listClassSections(req.user.school_id, { campusId, programId, academicTermId }, req.user);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
}

async function createSection(req, res, next) {
  try {
    const result = await service.createClassSection(req.user.school_id, req.body);
    res.status(201).json({ success: true, data: result });
  } catch (err) { next(err); }
}

async function getSectionDetails(req, res, next) {
  try {
    const result = await service.getClassSectionDetails(req.params.id, req.user.school_id);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
}

// Enrollments
async function enroll(req, res, next) {
  try {
    const result = await service.enrollStudent(req.user.school_id, req.body);
    res.status(201).json({ success: true, data: result });
  } catch (err) { next(err); }
}

async function unenroll(req, res, next) {
  try {
    await service.unenrollStudent(req.user.school_id, req.params.enrollmentId);
    res.json({ success: true, message: 'Student unenrolled successfully' });
  } catch (err) { next(err); }
}

// Timetable
async function listTimetable(req, res, next) {
  try {
    const { classSectionId, teacherId } = req.query;
    const result = await service.listTimetable(req.user.school_id, { classSectionId, teacherId }, req.user);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
}

async function createTimetableEntry(req, res, next) {
  try {
    const result = await service.createTimetableEntry(req.user.school_id, req.body);
    res.status(201).json({ success: true, data: result });
  } catch (err) { next(err); }
}

async function deleteTimetableEntry(req, res, next) {
  try {
    await service.deleteTimetableEntry(req.params.id, req.user.school_id);
    res.json({ success: true, message: 'Timetable entry deleted successfully' });
  } catch (err) { next(err); }
}

async function generateTimetable(req, res, next) {
  try {
    const run = await timetableGenerator.generate(req.user.school_id, req.user.id, req.body);
    res.status(201).json({ success: true, data: run });
  } catch (err) { next(err); }
}

async function getTimetablePlan(req, res, next) {
  try {
    const plan = await timetableGenerator.getPlan(req.user.school_id, req.params.termId);
    res.json({ success: true, data: plan });
  } catch (err) { next(err); }
}

async function saveTimetablePlan(req, res, next) {
  try {
    const plan = await timetableGenerator.savePlan(req.user.school_id, req.user.id, req.params.termId, req.body.items);
    res.json({ success: true, data: { academic_term_id: plan.academic_term_id, items: plan.items, updated_at: plan.updated_at }, message: 'Timetable plan saved' });
  } catch (err) { next(err); }
}

async function listTimetableRuns(req, res, next) {
  try {
    const runs = await timetableGenerator.listRuns(req.user.school_id, req.query.termId);
    res.json({ success: true, data: runs });
  } catch (err) { next(err); }
}

async function getTimetableRun(req, res, next) {
  try {
    const run = await timetableGenerator.getRun(req.user.school_id, req.params.runId);
    res.json({ success: true, data: run });
  } catch (err) { next(err); }
}

async function publishTimetableRun(req, res, next) {
  try {
    const run = await timetableGenerator.publish(req.user.school_id, req.params.runId);
    res.json({ success: true, data: run, message: 'Timetable published' });
  } catch (err) { next(err); }
}

// Exams
async function listExams(req, res, next) {
  try {
    const { academicTermId, subjectId } = req.query;
    const result = await service.listExams(req.user.school_id, { academicTermId, subjectId }, req.user);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
}

async function createExam(req, res, next) {
  try {
    const result = await service.createExam(req.user.school_id, req.body);
    res.status(201).json({ success: true, data: result });
  } catch (err) { next(err); }
}

async function deleteExam(req, res, next) {
  try {
    await service.deleteExam(req.params.id, req.user.school_id);
    res.json({ success: true, message: 'Exam deleted successfully' });
  } catch (err) { next(err); }
}

// Grading Scale
async function getGradingScale(req, res, next) {
  try {
    const result = await service.getGradingScale(req.user.school_id);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
}

async function saveGradingScale(req, res, next) {
  try {
    const result = await service.saveGradingScale(req.user.school_id, req.body);
    res.json({ success: true, data: result, message: 'Grading scale saved successfully' });
  } catch (err) { next(err); }
}

// Exam Results
async function listExamResults(req, res, next) {
  try {
    const result = await service.listExamResults(req.user.school_id, req.params.examId);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
}

async function recordExamResults(req, res, next) {
  try {
    const result = await service.recordExamResults(req.user.school_id, req.user.id, req.params.examId, req.body.results);
    res.json({ success: true, data: result, message: 'Exam results recorded successfully' });
  } catch (err) { next(err); }
}

async function approveExamResult(req, res, next) {
  try {
    const result = await service.approveExamResult(req.user.school_id, req.user.id, req.params.resultId);
    res.json({ success: true, data: result, message: 'Exam result approved successfully' });
  } catch (err) { next(err); }
}

async function listSubjects(req, res, next) {
  try {
    const result = await service.listSubjects(req.user.school_id);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
}

module.exports = {
  listSubjects,
  listTerms,
  createTerm,
  updateTerm,
  deleteTerm,
  listPrograms,
  createProgram,
  updateProgram,
  deleteProgram,
  listSections,
  createSection,
  getSectionDetails,
  enroll,
  unenroll,
  listTimetable,
  createTimetableEntry,
  deleteTimetableEntry,
    generateTimetable,
    getTimetablePlan,
    saveTimetablePlan,
  listTimetableRuns,
  getTimetableRun,
  publishTimetableRun,
  listExams,
  createExam,
  deleteExam,
  getGradingScale,
  saveGradingScale,
  listExamResults,
  recordExamResults,
  approveExamResult,
};
