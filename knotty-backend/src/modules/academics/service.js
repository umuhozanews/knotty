const prisma = require('../../config/database');
const { logAction } = require('../../utils/audit');

// ─── Academic Terms ───
async function listAcademicTerms(schoolId) {
  return prisma.academicTerm.findMany({
    where: { school_id: schoolId },
    orderBy: { start_date: 'asc' },
  });
}

async function createAcademicTerm(schoolId, data) {
  return prisma.academicTerm.create({
    data: {
      school_id: schoolId,
      name: data.name,
      start_date: new Date(data.start_date),
      end_date: new Date(data.end_date),
    },
  });
}

async function updateAcademicTerm(id, schoolId, data) {
  return prisma.academicTerm.update({
    where: { id, school_id: schoolId },
    data: {
      name: data.name,
      start_date: data.start_date ? new Date(data.start_date) : undefined,
      end_date: data.end_date ? new Date(data.end_date) : undefined,
    },
  });
}

async function deleteAcademicTerm(id, schoolId) {
  return prisma.academicTerm.delete({
    where: { id, school_id: schoolId },
  });
}

// ─── Programs ───
async function listPrograms(schoolId) {
  return prisma.program.findMany({
    where: { school_id: schoolId },
    orderBy: { name: 'asc' },
  });
}

async function createProgram(schoolId, data) {
  return prisma.program.create({
    data: {
      school_id: schoolId,
      name: data.name,
    },
  });
}

async function updateProgram(id, schoolId, data) {
  return prisma.program.update({
    where: { id, school_id: schoolId },
    data: { name: data.name },
  });
}

async function deleteProgram(id, schoolId) {
  return prisma.program.delete({
    where: { id, school_id: schoolId },
  });
}

// ─── Class Sections ───
async function listClassSections(schoolId, { campusId, programId, academicTermId } = {}) {
  const where = { school_id: schoolId };
  if (campusId) where.campus_id = campusId;
  if (programId) where.program_id = programId;
  if (academicTermId) where.academic_term_id = academicTermId;

  return prisma.classSection.findMany({
    where,
    include: {
      program: true,
      term: true,
      homeroom_teacher: {
        select: { id: true, first_name: true, last_name: true, email: true },
      },
      _count: { select: { enrollments: true } },
    },
    orderBy: { name: 'asc' },
  });
}

async function createClassSection(schoolId, data) {
  return prisma.classSection.create({
    data: {
      school_id: schoolId,
      campus_id: data.campus_id || null,
      program_id: data.program_id,
      academic_term_id: data.academic_term_id,
      name: data.name,
      homeroom_staff_id: data.homeroom_staff_id || null,
      capacity: data.capacity ? Number(data.capacity) : null,
    },
  });
}

async function getClassSectionDetails(id, schoolId) {
  const section = await prisma.classSection.findFirst({
    where: { id, school_id: schoolId },
    include: {
      program: true,
      term: true,
      homeroom_teacher: {
        select: { id: true, first_name: true, last_name: true, email: true },
      },
      enrollments: {
        include: {
          student: {
            include: {
              user: {
                select: { first_name: true, last_name: true, email: true, phone: true },
              },
            },
          },
        },
      },
      timetable_entries: {
        include: {
          subject: true,
          teacher: {
            select: { id: true, first_name: true, last_name: true },
          },
        },
        orderBy: [
          { day_of_week: 'asc' },
          { start_time: 'asc' },
        ],
      },
    },
  });

  if (!section) throw Object.assign(new Error('Class Section not found'), { status: 404 });
  return section;
}

// ─── Enrollments ───
async function enrollStudent(schoolId, { student_id, class_section_id, academic_term_id }) {
  // Check student
  const student = await prisma.student.findFirst({ where: { id: student_id, school_id } });
  if (!student) throw Object.assign(new Error('Student not found'), { status: 404 });

  // Check section
  const section = await prisma.classSection.findFirst({ where: { id: class_section_id, school_id } });
  if (!section) throw Object.assign(new Error('Class section not found'), { status: 404 });

  // Check capacity
  if (section.capacity) {
    const activeCount = await prisma.enrollment.count({
      where: { class_section_id, status: 'ACTIVE' },
    });
    if (activeCount >= section.capacity) {
      throw Object.assign(new Error('Class section is at full capacity'), { status: 400 });
    }
  }

  // Check if already enrolled in this term
  const existing = await prisma.enrollment.findFirst({
    where: { student_id, academic_term_id, status: 'ACTIVE' },
  });
  if (existing) {
    throw Object.assign(new Error('Student is already enrolled in a class section for this term'), { status: 400 });
  }

  return prisma.enrollment.create({
    data: {
      school_id: schoolId,
      student_id,
      class_section_id,
      academic_term_id,
      status: 'ACTIVE',
    },
  });
}

async function unenrollStudent(schoolId, enrollmentId) {
  const enrollment = await prisma.enrollment.findFirst({
    where: { id: enrollmentId, school_id: schoolId },
  });
  if (!enrollment) throw Object.assign(new Error('Enrollment record not found'), { status: 404 });

  return prisma.enrollment.update({
    where: { id: enrollmentId },
    data: { status: 'WITHDRAWN' },
  });
}

// ─── Timetable Entries ───
async function listTimetable(schoolId, { classSectionId, teacherId } = {}) {
  const where = { school_id: schoolId };
  if (classSectionId) where.class_section_id = classSectionId;
  if (teacherId) where.staff_id = teacherId;

  return prisma.timetableEntry.findMany({
    where,
    include: {
      class_section: {
        include: { program: true },
      },
      subject: true,
      teacher: {
        select: { id: true, first_name: true, last_name: true },
      },
    },
    orderBy: [
      { day_of_week: 'asc' },
      { start_time: 'asc' },
    ],
  });
}

async function createTimetableEntry(schoolId, data) {
  // Check conflicts
  const conflict = await prisma.timetableEntry.findFirst({
    where: {
      school_id: schoolId,
      day_of_week: Number(data.day_of_week),
      OR: [
        {
          class_section_id: data.class_section_id,
          start_time: { lte: data.end_time },
          end_time: { gte: data.start_time },
        },
        {
          staff_id: data.staff_id,
          start_time: { lte: data.end_time },
          end_time: { gte: data.start_time },
        },
      ],
    },
  });

  if (conflict) {
    throw Object.assign(new Error('Timetable conflict: either the class section or the teacher is busy during this slot'), { status: 400 });
  }

  return prisma.timetableEntry.create({
    data: {
      school_id: schoolId,
      class_section_id: data.class_section_id,
      subject_id: data.subject_id,
      staff_id: data.staff_id,
      day_of_week: Number(data.day_of_week),
      start_time: data.start_time,
      end_time: data.end_time,
      room: data.room || null,
    },
  });
}

async function deleteTimetableEntry(id, schoolId) {
  return prisma.timetableEntry.delete({
    where: { id, school_id: schoolId },
  });
}

// ─── Exams ───
async function listExams(schoolId, { academicTermId, subjectId } = {}) {
  const where = { school_id: schoolId };
  if (academicTermId) where.academic_term_id = academicTermId;
  if (subjectId) where.subject_id = subjectId;

  return prisma.exam.findMany({
    where,
    include: {
      subject: true,
      term: true,
      _count: { select: { results: true } },
    },
    orderBy: { exam_date: 'desc' },
  });
}

async function createExam(schoolId, data) {
  return prisma.exam.create({
    data: {
      school_id: schoolId,
      name: data.name,
      subject_id: data.subject_id,
      academic_term_id: data.academic_term_id,
      exam_date: new Date(data.exam_date),
      max_score: Number(data.max_score || 100),
    },
  });
}

async function deleteExam(id, schoolId) {
  return prisma.exam.delete({
    where: { id, school_id: schoolId },
  });
}

// ─── Grading Scale ───
async function getGradingScale(schoolId) {
  let scale = await prisma.gradingScale.findFirst({
    where: { school_id: schoolId },
  });

  if (!scale) {
    // Return default fallback
    const defaultBands = [
      { min: 90, max: 100, letter: 'A', gpa: 4.0 },
      { min: 80, max: 89, letter: 'B', gpa: 3.0 },
      { min: 70, max: 79, letter: 'C', gpa: 2.0 },
      { min: 60, max: 69, letter: 'D', gpa: 1.0 },
      { min: 50, max: 59, letter: 'E', gpa: 0.5 },
      { min: 0, max: 49, letter: 'F', gpa: 0.0 },
    ];
    return { name: 'Default Scale', bands: defaultBands };
  }
  return scale;
}

async function saveGradingScale(schoolId, { name, bands }) {
  const existing = await prisma.gradingScale.findFirst({
    where: { school_id: schoolId },
  });

  if (existing) {
    return prisma.gradingScale.update({
      where: { id: existing.id },
      data: { name, bands },
    });
  } else {
    return prisma.gradingScale.create({
      data: { school_id: schoolId, name, bands },
    });
  }
}

// Helper to determine letter grade
function determineLetterGrade(score, maxScore, gradingScale) {
  const pct = (score / maxScore) * 100;
  const bands = gradingScale.bands || [];
  for (const band of bands) {
    if (pct >= band.min && pct <= band.max) {
      return band.letter;
    }
  }
  // Fallbacks if no match
  if (pct >= 80) return 'A';
  if (pct >= 70) return 'B';
  if (pct >= 60) return 'C';
  if (pct >= 50) return 'D';
  return 'F';
}

// ─── Exam Results ───
async function listExamResults(schoolId, examId) {
  return prisma.examResult.findMany({
    where: { exam_id: examId, school_id: schoolId },
    include: {
      student: {
        include: {
          user: { select: { first_name: true, last_name: true } },
        },
      },
      recorder: { select: { first_name: true, last_name: true } },
      approver: { select: { first_name: true, last_name: true } },
    },
  });
}

async function recordExamResults(schoolId, actorUserId, examId, results) {
  const exam = await prisma.exam.findFirst({
    where: { id: examId, school_id: schoolId },
  });
  if (!exam) throw Object.assign(new Error('Exam not found'), { status: 404 });

  const gradingScale = await getGradingScale(schoolId);
  const savedResults = [];

  for (const res of results) {
    const { student_id, score } = res;
    if (score > exam.max_score || score < 0) {
      throw Object.assign(new Error(`Score ${score} is invalid for max score ${exam.max_score}`), { status: 400 });
    }

    const gradeLetter = determineLetterGrade(score, exam.max_score, gradingScale);

    // Check existing
    const existing = await prisma.examResult.findFirst({
      where: { exam_id: examId, student_id },
    });

    let record;
    if (existing) {
      record = await prisma.examResult.update({
        where: { id: existing.id },
        data: {
          score: Number(score),
          grade_letter: gradeLetter,
          entered_by: actorUserId,
          approved_by: null, // Reset approval on change
          approved_at: null,
        },
      });

      // Audit Log
      await logAction({
        school_id: schoolId,
        actor_user_id: actorUserId,
        action: 'GRADE_CHANGE',
        entity_type: 'ExamResult',
        entity_id: record.id,
        before_state: existing,
        after_state: record,
      });
    } else {
      record = await prisma.examResult.create({
        data: {
          school_id: schoolId,
          exam_id: examId,
          student_id,
          score: Number(score),
          grade_letter: gradeLetter,
          entered_by: actorUserId,
        },
      });

      // Audit Log
      await logAction({
        school_id: schoolId,
        actor_user_id: actorUserId,
        action: 'GRADE_ENTER',
        entity_type: 'ExamResult',
        entity_id: record.id,
        before_state: null,
        after_state: record,
      });
    }
    savedResults.push(record);
  }

  return savedResults;
}

async function approveExamResult(schoolId, actorUserId, resultId) {
  const result = await prisma.examResult.findFirst({
    where: { id: resultId, school_id: schoolId },
  });
  if (!result) throw Object.assign(new Error('Exam result not found'), { status: 404 });

  const updated = await prisma.examResult.update({
    where: { id: resultId },
    data: {
      approved_by: actorUserId,
      approved_at: new Date(),
    },
  });

  await logAction({
    school_id: schoolId,
    actor_user_id: actorUserId,
    action: 'GRADE_APPROVE',
    entity_type: 'ExamResult',
    entity_id: resultId,
    before_state: result,
    after_state: updated,
  });

  return updated;
}

module.exports = {
  // Terms
  listAcademicTerms,
  createAcademicTerm,
  updateAcademicTerm,
  deleteAcademicTerm,
  // Programs
  listPrograms,
  createProgram,
  updateProgram,
  deleteProgram,
  // Class Sections
  listClassSections,
  createClassSection,
  getClassSectionDetails,
  // Enrollments
  enrollStudent,
  unenrollStudent,
  // Timetable
  listTimetable,
  createTimetableEntry,
  deleteTimetableEntry,
  // Exams
  listExams,
  createExam,
  deleteExam,
  // Grading scale
  getGradingScale,
  saveGradingScale,
  // Results
  listExamResults,
  recordExamResults,
  approveExamResult,
};
