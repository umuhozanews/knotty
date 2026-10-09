const prisma = require('../../config/database');

const httpError = (message, status = 400) => Object.assign(new Error(message), { status });
const timeToMinutes = (value) => {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(String(value || ''));
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
};
const minutesToTime = (value) => `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;

function buildSlots(config) {
  // Fixed school day: 08:00–17:00, 11 × 40-minute lessons,
  // 20-minute breaks after periods 3 and 9, and a 60-minute lunch after period 6.
  const slots = [];
  const pausesAfter = new Map([[3, 20], [6, 60], [9, 20]]);
  for (const day of [1, 2, 3, 4, 5]) {
    let cursor = 8 * 60;
    for (let period = 1; period <= 11; period += 1) {
      slots.push({ key: `${day}:${period}`, day, period, start_time: minutesToTime(cursor), end_time: minutesToTime(cursor + 40) });
      cursor += 40 + (pausesAfter.get(period) || 0);
    }
    if (cursor !== 17 * 60) throw httpError('Internal school day configuration must total 08:00–17:00', 500);
  }
  return slots;
}

function buildSchedule(requirements, slots, maxTeacherPerDay, blockedSlots = []) {
  const teacherLoad = new Map();
  const classLoad = new Map();
  const units = [];
  requirements.forEach((req, requirement_index) => {
    const count = Number(req.periods_per_week);
    for (let n = 0; n < count; n += 1) units.push({ ...req, requirement_index, ordinal: n });
    teacherLoad.set(req.staff_id, (teacherLoad.get(req.staff_id) || 0) + count);
    classLoad.set(req.class_section_id, (classLoad.get(req.class_section_id) || 0) + count);
  });
  units.sort((a, b) => (teacherLoad.get(b.staff_id) || 0) - (teacherLoad.get(a.staff_id) || 0)
    || (classLoad.get(b.class_section_id) || 0) - (classLoad.get(a.class_section_id) || 0)
    || Number(b.periods_per_week) - Number(a.periods_per_week));

  const blocked = new Set(blockedSlots.map((x) => `${x.staff_id}:${x.day}:${x.period}`));
  const classBusy = new Set(); const teacherBusy = new Set(); const roomBusy = new Set();
  const classSubjectDay = new Map(); const classDayLoad = new Map(); const teacherDayLoad = new Map();
  const chosen = new Array(units.length); let visited = 0; const nodeLimit = 100000;
  const reqKey = (req, day) => `${req.class_section_id}:${req.subject_id}:${day}`;

  function place(index) {
    if (index === units.length) return true;
    if (++visited > nodeLimit) return false;
    const req = units[index];
    const options = slots.map((slot) => {
      const cell = `${slot.day}:${slot.period}`;
      const td = `${req.staff_id}:${slot.day}`;
      const cd = `${req.class_section_id}:${slot.day}`;
      const subjectDay = reqKey(req, slot.day);
      const roomKey = req.room ? `${String(req.room).trim().toLocaleLowerCase()}:${slot.day}:${slot.period}` : null;
      if (classBusy.has(`${req.class_section_id}:${cell}`) || teacherBusy.has(`${req.staff_id}:${cell}`)
        || blocked.has(`${req.staff_id}:${slot.day}:${slot.period}`)
        || (req.is_science && slot.period >= 10)
        || (roomKey && roomBusy.has(roomKey))
        || (maxTeacherPerDay && (teacherDayLoad.get(td) || 0) >= maxTeacherPerDay)) return null;
      const repeat = classSubjectDay.get(subjectDay) || 0;
      const classLoadToday = classDayLoad.get(cd) || 0;
      const teacherLoadToday = teacherDayLoad.get(td) || 0;
      const previousSame = chosen.some((entry) => entry && entry.class_section_id === req.class_section_id
        && entry.subject_id === req.subject_id && entry.day_of_week === slot.day
        && (entry.end_time === slot.start_time || slot.end_time === entry.start_time));
      const score = repeat * 100 + (previousSame ? 60 : 0) + classLoadToday * 3 + teacherLoadToday * 2;
      return { slot, cell, td, cd, subjectDay, roomKey, score };
    }).filter(Boolean).sort((a, b) => a.score - b.score || a.slot.period - b.slot.period);

    for (const option of options) {
      classBusy.add(`${req.class_section_id}:${option.cell}`);
      teacherBusy.add(`${req.staff_id}:${option.cell}`);
      if (option.roomKey) roomBusy.add(option.roomKey);
      classSubjectDay.set(option.subjectDay, (classSubjectDay.get(option.subjectDay) || 0) + 1);
      classDayLoad.set(option.cd, (classDayLoad.get(option.cd) || 0) + 1);
      teacherDayLoad.set(option.td, (teacherDayLoad.get(option.td) || 0) + 1);
      chosen[index] = { class_section_id: req.class_section_id, subject_id: req.subject_id, staff_id: req.staff_id,
        day_of_week: option.slot.day, start_time: option.slot.start_time, end_time: option.slot.end_time,
        room: req.room || null, requirement_index: req.requirement_index };
      if (place(index + 1)) return true;
      chosen[index] = null;
      classBusy.delete(`${req.class_section_id}:${option.cell}`);
      teacherBusy.delete(`${req.staff_id}:${option.cell}`);
      if (option.roomKey) roomBusy.delete(option.roomKey);
      const sd = (classSubjectDay.get(option.subjectDay) || 1) - 1;
      if (sd) classSubjectDay.set(option.subjectDay, sd); else classSubjectDay.delete(option.subjectDay);
      for (const [map, key] of [[classDayLoad, option.cd], [teacherDayLoad, option.td]]) {
        const value = (map.get(key) || 1) - 1;
        if (value) map.set(key, value); else map.delete(key);
      }
      if (visited > nodeLimit) return false;
    }
    return false;
  }

  const complete = place(0);
  const placed = chosen.filter(Boolean);
  const placedByReq = new Map();
  for (const entry of placed) placedByReq.set(entry.requirement_index, (placedByReq.get(entry.requirement_index) || 0) + 1);
  const unplaced = requirements.map((req, i) => ({
    class_section_id: req.class_section_id, subject_id: req.subject_id, staff_id: req.staff_id,
    requested: Number(req.periods_per_week), placed: placedByReq.get(i) || 0,
  })).filter((x) => x.placed < x.requested);
  return { entries: placed, complete, visited, unplaced };
}

function normalizePlanItems(items, requireComplete = true) {
  if (!Array.isArray(items) || !items.length || items.length > 800) throw httpError('Add the class subjects and teacher assignments before generating');
  const normalized = items.map((r) => ({
    class_section_id: String(r.class_section_id || ''), subject_id: String(r.subject_id || ''), staff_id: String(r.staff_id || ''),
    periods_per_week: Number(r.periods_per_week), room: r.room ? String(r.room).trim() : null,
    category: r.category === 'PRINCIPAL' ? 'PRINCIPAL' : 'SUBSIDIARY', is_science: Boolean(r.is_science),
  }));
  if (normalized.some((r) => !r.class_section_id || !r.subject_id || !r.staff_id || !Number.isInteger(r.periods_per_week) || r.periods_per_week < 1 || r.periods_per_week > 55)) throw httpError('Each class subject needs a teacher and 1 to 55 periods per week');
  const seen = new Set();
  for (const row of normalized) {
    const key = `${row.class_section_id}:${row.subject_id}`;
    if (seen.has(key)) throw httpError('Each subject can appear only once in a class plan');
    seen.add(key);
  }
  const totals = new Map(); const principal = new Map();
  for (const r of normalized) {
    totals.set(r.class_section_id, (totals.get(r.class_section_id) || 0) + r.periods_per_week);
    if (r.category === 'PRINCIPAL') principal.set(`${r.class_section_id}:${r.subject_id}`, r.periods_per_week);
  }
  for (const [sectionId, count] of totals) {
    if (requireComplete && count !== 55) throw httpError(`Each included class needs 55 weekly lessons. Class ${sectionId} currently has ${count}.`);
    if (!requireComplete && count > 55) throw httpError(`A class cannot have more than 55 weekly lessons. Class ${sectionId} currently has ${count}.`);
  }
  for (const count of principal.values()) if (count !== 9) throw httpError('Every principal subject must have exactly 9 periods per week for its class');
  return normalized;
}

async function validatedPlan(schoolId, termId, items, requireComplete = true) {
  const normalized = normalizePlanItems(items, requireComplete);
  const sectionIds = [...new Set(normalized.map((r) => r.class_section_id))];
  const subjectIds = [...new Set(normalized.map((r) => r.subject_id))];
  const teacherIds = [...new Set(normalized.map((r) => r.staff_id))];
  const [sections, subjects, teachers] = await Promise.all([
    prisma.classSection.findMany({ where: { id: { in: sectionIds }, school_id: schoolId, academic_term_id: termId }, select: { id: true } }),
    prisma.subject.findMany({ where: { id: { in: subjectIds }, school_id: schoolId }, select: { id: true } }),
    prisma.schoolMembership.findMany({ where: { user_id: { in: teacherIds }, school_id: schoolId, status: 'ACTIVE', role: 'TEACHER' }, select: { user_id: true } }),
  ]);
  if (sections.length !== sectionIds.length || subjects.length !== subjectIds.length || teachers.length !== teacherIds.length) throw httpError('Every class, subject, and teacher must be active in this school and term');
  return normalized;
}

async function getPlan(schoolId, termId) {
  const term = await prisma.academicTerm.findFirst({ where: { id: termId, school_id: schoolId }, select: { id: true } });
  if (!term) throw httpError('Academic term not found in this school', 404);
  const plan = await prisma.timetablePlan.findUnique({ where: { school_id_academic_term_id: { school_id: schoolId, academic_term_id: termId } } });
  return { academic_term_id: termId, items: plan?.items || [] };
}

async function savePlan(schoolId, userId, termId, items) {
  const term = await prisma.academicTerm.findFirst({ where: { id: termId, school_id: schoolId }, select: { id: true } });
  if (!term) throw httpError('Academic term not found in this school', 404);
  const normalized = await validatedPlan(schoolId, term.id, items, false);
  return prisma.timetablePlan.upsert({
    where: { school_id_academic_term_id: { school_id: schoolId, academic_term_id: term.id } },
    create: { school_id: schoolId, academic_term_id: term.id, updated_by: userId, items: normalized },
    update: { updated_by: userId, items: normalized },
  });
}

async function generate(schoolId, userId, config) {
  if (!config?.academic_term_id) throw httpError('Academic term is required');
  const term = await prisma.academicTerm.findFirst({ where: { id: config.academic_term_id, school_id: schoolId }, select: { id: true } });
  if (!term) throw httpError('Academic term not found in this school', 404);
  const saved = await prisma.timetablePlan.findUnique({ where: { school_id_academic_term_id: { school_id: schoolId, academic_term_id: term.id } } });
  if (!saved) throw httpError('Save the class subjects and teacher assignments before generating');
  const normalized = await validatedPlan(schoolId, term.id, saved.items);
  const allTermClasses = await prisma.classSection.findMany({ where: { school_id: schoolId, academic_term_id: term.id }, select: { id: true } });
  const plannedClassIds = [...new Set(normalized.map((r) => r.class_section_id))];
  const missingClasses = allTermClasses.filter((section) => !plannedClassIds.includes(section.id));
  if (missingClasses.length) throw httpError(`Add subjects and teacher assignments for every class in this term before generating (${missingClasses.length} class(es) missing)`);
  const slots = buildSlots(config);
  const requested = normalized.reduce((sum, r) => sum + r.periods_per_week, 0);
  const teacherWeeklyLoads = new Map();
  for (const r of normalized) teacherWeeklyLoads.set(r.staff_id, (teacherWeeklyLoads.get(r.staff_id) || 0) + r.periods_per_week);
  const overloaded = [...teacherWeeklyLoads].find(([, load]) => load > 45);
  if (overloaded) throw httpError(`A teacher cannot be assigned more than 45 periods in a five-day week (9 per day). Teacher ${overloaded[0]} has ${overloaded[1]}.`);
  const result = buildSchedule(normalized, slots, 9, config.blocked_slots || []);
  const storedConfig = { academic_term_id: term.id, days: [1, 2, 3, 4, 5], start_time: '08:00', periods_per_day: 11, period_minutes: 40, breaks_minutes: [20, 60, 20], requirements: normalized };
  const run = await prisma.scheduleRun.create({
    data: {
      school_id: schoolId, academic_term_id: term.id, generated_by: userId,
      status: result.complete ? 'DRAFT' : 'INFEASIBLE', config: storedConfig,
      diagnostics: { complete: result.complete, visited_nodes: result.visited, requested_lessons: requested, placed_lessons: result.entries.length, unplaced: result.unplaced },
      entries: { createMany: { data: result.entries } },
    },
    include: { entries: { orderBy: [{ day_of_week: 'asc' }, { start_time: 'asc' }], include: { class_section: { select: { id: true, name: true } }, subject: { select: { id: true, name: true, code: true } }, teacher: { select: { id: true, first_name: true, last_name: true } } } } },
  });
  return run;
}

async function listRuns(schoolId, termId) {
  return prisma.scheduleRun.findMany({
    where: { school_id: schoolId, ...(termId ? { academic_term_id: termId } : {}) },
    orderBy: { created_at: 'desc' }, take: 20,
    select: { id: true, academic_term_id: true, status: true, diagnostics: true, score: true, created_at: true, published_at: true, _count: { select: { entries: true } } },
  });
}

async function getRun(schoolId, runId) {
  const run = await prisma.scheduleRun.findFirst({
    where: { id: runId, school_id: schoolId },
    include: { entries: { orderBy: [{ day_of_week: 'asc' }, { start_time: 'asc' }], include: { class_section: { select: { id: true, name: true } }, subject: { select: { id: true, name: true, code: true } }, teacher: { select: { id: true, first_name: true, last_name: true } } } } },
  });
  if (!run) throw httpError('Schedule run not found', 404);
  return run;
}

async function publish(schoolId, runId) {
  return prisma.$transaction(async (tx) => {
    const run = await tx.scheduleRun.findFirst({ where: { id: runId, school_id: schoolId }, include: { entries: true } });
    if (!run) throw httpError('Schedule run not found', 404);
    if (run.status !== 'DRAFT' || !run.diagnostics?.complete || !run.entries.length) throw httpError('Only a complete generated draft can be published');
    const sections = [...new Set(run.entries.map((e) => e.class_section_id))];
    const conflict = await tx.timetableEntry.findFirst({
      where: { school_id: schoolId, class_section_id: { notIn: sections }, class_section: { academic_term_id: run.academic_term_id }, day_of_week: { in: [...new Set(run.entries.map((e) => e.day_of_week))] },
        OR: run.entries.flatMap((e) => [
          { staff_id: e.staff_id, day_of_week: e.day_of_week, start_time: { lt: e.end_time }, end_time: { gt: e.start_time } },
          ...(e.room ? [{ room: { equals: e.room, mode: 'insensitive' }, day_of_week: e.day_of_week, start_time: { lt: e.end_time }, end_time: { gt: e.start_time } }] : []),
        ]) },
      select: { id: true },
    });
    if (conflict) throw httpError('The school timetable changed since generation. Regenerate to check conflicts before publishing', 409);
    await tx.timetableEntry.deleteMany({ where: { school_id: schoolId, class_section_id: { in: sections } } });
    await tx.timetableEntry.createMany({ data: run.entries.map((e) => ({
      school_id: schoolId, class_section_id: e.class_section_id, subject_id: e.subject_id, staff_id: e.staff_id,
      day_of_week: e.day_of_week, start_time: e.start_time, end_time: e.end_time, room: e.room, schedule_run_id: run.id,
    })) });
    return tx.scheduleRun.update({ where: { id: run.id }, data: { status: 'PUBLISHED', published_at: new Date() }, select: { id: true, status: true, published_at: true } });
  });
}

module.exports = { generate, listRuns, getRun, publish, getPlan, savePlan };
