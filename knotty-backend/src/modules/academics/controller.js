const service = require('./service');

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
    const result = await service.listClassSections(req.user.school_id, { campusId, programId, academicTermId });
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
    const result = await service.listTimetable(req.user.school_id, { classSectionId, teacherId });
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

// Exams
async function listExams(req, res, next) {
  try {
    const { academicTermId, subjectId } = req.query;
    const result = await service.listExams(req.user.school_id, { academicTermId, subjectId });
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

module.exports = {
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
  listExams,
  createExam,
  deleteExam,
  getGradingScale,
  saveGradingScale,
  listExamResults,
  recordExamResults,
  approveExamResult,
};
