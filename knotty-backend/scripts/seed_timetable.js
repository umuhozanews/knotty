require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');


const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Seeding timetable and new academic records...');

  const school = await prisma.school.findFirst({ where: { email: 'admin@knottyschool.rw' } });
  if (!school) throw new Error('School not found. Run database seeds first.');

  const teacher = await prisma.user.findFirst({ where: { school_id: school.id, role: 'TEACHER' } });
  if (!teacher) throw new Error('Teacher not found.');

  // Clean old entries
  await prisma.examResult.deleteMany({ where: { school_id: school.id } });
  await prisma.exam.deleteMany({ where: { school_id: school.id } });
  await prisma.timetableEntry.deleteMany({ where: { school_id: school.id } });
  await prisma.enrollment.deleteMany({ where: { school_id: school.id } });
  await prisma.classSection.deleteMany({ where: { school_id: school.id } });
  await prisma.program.deleteMany({ where: { school_id: school.id } });
  await prisma.academicTerm.deleteMany({ where: { school_id: school.id } });
  await prisma.subject.deleteMany({ where: { school_id: school.id } });

  // 1. Academic Term
  const term = await prisma.academicTerm.create({
    data: {
      school_id: school.id,
      name: 'Term 1 2026',
      start_date: new Date('2026-01-01'),
      end_date: new Date('2026-07-01'),
    }
  });

  // 2. Program
  const program = await prisma.program.create({
    data: {
      school_id: school.id,
      name: 'MCB (Math-Chem-Bio)',
    }
  });

  // 3. Class Section
  const section = await prisma.classSection.create({
    data: {
      school_id: school.id,
      program_id: program.id,
      academic_term_id: term.id,
      name: 'S5A Science',
      homeroom_staff_id: teacher.id,
      capacity: 40,
    }
  });

  // 4. Subjects
  const subjectsData = [
    { id: 'sub-math', name: 'Mathematics', code: 'MATH' },
    { id: 'sub-phy', name: 'Physics', code: 'PHYS' },
    { id: 'sub-chem', name: 'Chemistry', code: 'CHEM' },
    { id: 'sub-bio', name: 'Biology', code: 'BIOL' },
    { id: 'sub-eng', name: 'English', code: 'ENGL' },
  ];

  const subjects = [];
  for (const s of subjectsData) {
    const sub = await prisma.subject.create({
      data: {
        id: s.id,
        school_id: school.id,
        level_id: 'level-s5-seed',
        name: s.name,
        code: s.code,
        teacher_id: teacher.id,
      }
    });
    subjects.push(sub);
  }

  // 5. Enroll Students in S5A Science
  const studentsList = await prisma.student.findMany({
    where: { school_id: school.id, level_id: 'level-s5-seed' }
  });

  for (const s of studentsList) {
    await prisma.enrollment.create({
      data: {
        school_id: school.id,
        student_id: s.id,
        class_section_id: section.id,
        academic_term_id: term.id,
        status: 'ACTIVE',
      }
    });
  }
  console.log(`Enrolled ${studentsList.length} students into class section ${section.name}`);

  // 6. Timetable Entries
  const timetableEntries = [
    // Monday
    { day: 1, start: '08:30', end: '10:00', subjectId: 'sub-math', room: 'Room 101' },
    { day: 1, start: '10:30', end: '12:00', subjectId: 'sub-phy', room: 'Physics Lab' },
    { day: 1, start: '13:30', end: '15:00', subjectId: 'sub-chem', room: 'Chemistry Lab' },

    // Tuesday
    { day: 2, start: '08:30', end: '10:00', subjectId: 'sub-bio', room: 'Biology Lab' },
    { day: 2, start: '10:30', end: '12:00', subjectId: 'sub-eng', room: 'Room 101' },
    { day: 2, start: '13:30', end: '15:00', subjectId: 'sub-math', room: 'Room 101' },

    // Wednesday
    { day: 3, start: '08:30', end: '10:00', subjectId: 'sub-chem', room: 'Room 101' },
    { day: 3, start: '10:30', end: '12:00', subjectId: 'sub-phy', room: 'Room 101' },
    { day: 3, start: '13:30', end: '15:00', subjectId: 'sub-bio', room: 'Room 101' },

    // Thursday
    { day: 4, start: '08:30', end: '10:00', subjectId: 'sub-eng', room: 'Room 102' },
    { day: 4, start: '10:30', end: '12:00', subjectId: 'sub-math', room: 'Room 101' },
    { day: 4, start: '13:30', end: '15:00', subjectId: 'sub-phy', room: 'Physics Lab' },

    // Friday
    { day: 5, start: '08:30', end: '10:00', subjectId: 'sub-chem', room: 'Chemistry Lab' },
    { day: 5, start: '10:30', end: '12:00', subjectId: 'sub-bio', room: 'Biology Lab' },
    { day: 5, start: '13:30', end: '14:30', subjectId: 'sub-eng', room: 'Room 101' },

    // Saturday
    { day: 6, start: '09:00', end: '11:00', subjectId: 'sub-phy', room: 'Main Hall (Seminar)' },
  ];

  // Dynamically insert a "Live Now" class for today's day of the week to show off the indicator!
  const now = new Date();
  const todayDay = now.getDay() === 0 ? 7 : now.getDay();

  const formatTime = (date) => {
    const h = String(date.getHours()).padStart(2, '0');
    const m = String(date.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  };

  const liveStart = new Date(now.getTime() - 45 * 60 * 1000); // 45 mins ago
  const liveEnd = new Date(now.getTime() + 45 * 60 * 1000);   // 45 mins from now
  const liveStartTimeStr = formatTime(liveStart);
  const liveEndTimeStr = formatTime(liveEnd);

  const liveSubjects = ['sub-math', 'sub-phy', 'sub-chem', 'sub-bio', 'sub-eng'];
  const todayLiveSubject = liveSubjects[todayDay % liveSubjects.length];

  timetableEntries.push({
    day: todayDay,
    start: liveStartTimeStr,
    end: liveEndTimeStr,
    subjectId: todayLiveSubject,
    room: todayDay % 2 === 0 ? 'Science Lab (Live)' : 'Room 101 (Live)'
  });

  for (const entry of timetableEntries) {
    await prisma.timetableEntry.create({
      data: {
        school_id: school.id,
        class_section_id: section.id,
        subject_id: entry.subjectId,
        staff_id: teacher.id,
        day_of_week: entry.day,
        start_time: entry.start,
        end_time: entry.end,
        room: entry.room,
      }
    });
  }

  console.log('Seeded', timetableEntries.length, 'timetable slots successfully!');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
