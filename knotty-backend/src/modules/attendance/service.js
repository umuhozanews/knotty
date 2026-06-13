const prisma = require('../../config/database');
const { sendAttendanceAlert } = require('../../integrations/africas-talking');
const { paginate, paginatedResponse } = require('../../utils/helpers');

async function scanAttendance(cardNumber, recordedBy, options = {}) {
  const {
    type,
    date,
    tapInStart,
    tapInEnd,
    tapOutStart,
    tapOutEnd,
  } = options;

  const card = await prisma.knottyCard.findUnique({
    where: { card_number: cardNumber },
    include: {
      student: {
        include: {
          user: { select: { first_name: true, last_name: true, profile_photo: true } },
          class: { select: { name: true } },
          level: { select: { name: true } },
          parent: { select: { phone: true } },
        },
      },
    },
  });

  if (!card || !card.is_active || card.is_frozen) {
    throw Object.assign(new Error('Card invalid or inactive'), { status: 400 });
  }

  const student = card.student;
  const now = new Date();
  
  let targetDate;
  if (date) {
    targetDate = new Date(date);
  } else {
    const kigaliDateStr = now.toLocaleDateString('en-ZA', { timeZone: 'Africa/Kigali' });
    targetDate = new Date(kigaliDateStr.replace(/\//g, '-'));
  }
  targetDate.setUTCHours(0, 0, 0, 0);

  // Load school settings for late threshold
  const school = await prisma.school.findUnique({
    where: { id: student.school_id },
    select: { school_start_time: true },
  });
  const [lateHr, lateMn] = (school?.school_start_time ?? '08:30').split(':').map(Number);

  const existing = await prisma.attendance.findUnique({
    where: { student_id_date: { student_id: student.id, date: targetDate } },
  });

  const studentInclude = {
    student: {
      include: {
        user: { select: { first_name: true, last_name: true, profile_photo: true } },
        class: { select: { name: true } },
        level: { select: { name: true } },
      },
    },
  };

  const nowKigali = new Date(now.toLocaleString('en-US', { timeZone: 'Africa/Kigali' }));
  const kigaliHr = nowKigali.getHours();
  const kigaliMn = nowKigali.getMinutes();
  const nowTimeStr = `${String(kigaliHr).padStart(2, '0')}:${String(kigaliMn).padStart(2, '0')}`;

  const isInRange = (timeStr, startStr, endStr) => {
    if (!startStr || !endStr) return true;
    return timeStr >= startStr && timeStr <= endStr;
  };

  const isTapIn = type ? (type === 'IN') : (!existing);

  // ── TAP IN ───────────────────────────────────────────────────────────────────
  if (isTapIn) {
    if (tapInStart && tapInEnd) {
      if (!isInRange(nowTimeStr, tapInStart, tapInEnd)) {
        throw Object.assign(
          new Error(`Tap-in not allowed. Current time (${nowTimeStr}) is outside the tap-in window (${tapInStart} - ${tapInEnd})`),
          { status: 400 }
        );
      }
    }

    const isLate = (kigaliHr > lateHr) || (kigaliHr === lateHr && kigaliMn > lateMn);
    const status = isLate ? 'LATE' : 'PRESENT';

    if (existing) {
      const updated = await prisma.attendance.update({
        where: { id: existing.id },
        data: { check_in_time: now, check_out_time: null, status },
        include: studentInclude,
      });
      return { ...updated, action: 'TAP_IN', card_number: card.card_number };
    }

    const created = await prisma.attendance.create({
      data: {
        student_id: student.id,
        class_id:   student.class_id,
        school_id:  student.school_id,
        date: targetDate,
        check_in_time: now,
        status,
        recorded_by: recordedBy,
      },
      include: studentInclude,
    });

    if (status === 'LATE' && student.parent?.phone) {
      sendAttendanceAlert(
        student.parent.phone,
        `${student.user.first_name} ${student.user.last_name}`,
        'LATE',
        now.toLocaleTimeString('en-RW', { timeZone: 'Africa/Kigali' })
      ).catch(console.error);
    }

    return {
      ...created,
      action: 'TAP_IN',
      card_number: card.card_number,
    };
  }

  // ── TAP OUT ──────────────────────────────────────────────────────────────────
  else {
    if (tapOutStart && tapOutEnd) {
      if (!isInRange(nowTimeStr, tapOutStart, tapOutEnd)) {
        throw Object.assign(
          new Error(`Tap-out not allowed. Current time (${nowTimeStr}) is outside the tap-out window (${tapOutStart} - ${tapOutEnd})`),
          { status: 400 }
        );
      }
    }

    if (!existing) {
      throw Object.assign(new Error('Cannot Tap Out without checking in first'), { status: 400 });
    }

    if (existing.check_out_time) {
      return { ...existing, action: 'ALREADY_OUT', card_number: card.card_number };
    }

    const updated = await prisma.attendance.update({
      where: { id: existing.id },
      data: { check_out_time: now },
      include: studentInclude,
    });

    return { ...updated, action: 'TAP_OUT', card_number: card.card_number };
  }
}

async function bulkMarkAttendance(classId, records, schoolId, recordedBy) {
  const now = new Date();
  const kigaliDateStr = now.toLocaleDateString('en-ZA', { timeZone: 'Africa/Kigali' });
  const today = new Date(kigaliDateStr.replace(/\//g, '-'));
  today.setUTCHours(0, 0, 0, 0);

  const ops = records.map(({ student_id, status, note }) =>
    prisma.attendance.upsert({
      where: { student_id_date: { student_id, date: today } },
      create: {
        student_id,
        class_id: classId,
        school_id: schoolId,
        date: today,
        check_in_time: new Date(),
        status,
        note,
        recorded_by: recordedBy,
      },
      update: { status, note },
    })
  );

  const results = await prisma.$transaction(ops);

  // Alert parents for absent students
  const absentIds = records.filter((r) => r.status === 'ABSENT').map((r) => r.student_id);
  if (absentIds.length) {
    const absentStudents = await prisma.student.findMany({
      where: { id: { in: absentIds } },
      include: {
        user: { select: { first_name: true, last_name: true } },
        parent: { select: { phone: true } },
      },
    });
    absentStudents.forEach((s) => {
      if (s.parent?.phone) {
        sendAttendanceAlert(
          s.parent.phone,
          `${s.user.first_name} ${s.user.last_name}`,
          'ABSENT'
        ).catch(console.error);
      }
    });
  }

  return results;
}

async function getStudentAttendance(studentId, { page, limit }) {
  const { skip, take } = paginate(null, page, limit);
  const [data, total] = await Promise.all([
    prisma.attendance.findMany({
      where: { student_id: studentId },
      skip,
      take,
      orderBy: { date: 'desc' },
    }),
    prisma.attendance.count({ where: { student_id: studentId } }),
  ]);
  return paginatedResponse(data, total, page, limit);
}

async function getClassAttendance(classId, date) {
  const targetDate = date ? new Date(date) : new Date();
  targetDate.setHours(0, 0, 0, 0);

  return prisma.attendance.findMany({
    where: { class_id: classId, date: targetDate },
    include: {
      student: {
        include: { user: { select: { first_name: true, last_name: true, profile_photo: true } } },
      },
    },
    orderBy: { check_in_time: 'asc' },
  });
}

async function getAttendanceReport(studentId, { from, to }) {
  const where = {
    student_id: studentId,
    ...(from && { date: { gte: new Date(from) } }),
    ...(to && { date: { lte: new Date(to) } }),
  };

  const records = await prisma.attendance.findMany({ where, orderBy: { date: 'asc' } });
  const summary = records.reduce(
    (acc, r) => { acc[r.status] = (acc[r.status] || 0) + 1; return acc; },
    { PRESENT: 0, ABSENT: 0, LATE: 0, EXCUSED: 0 }
  );

  return { records, summary, total: records.length };
}

async function scanAttendanceByNFC(nfcUid, recordedBy, options = {}) {
  const card = await prisma.knottyCard.findFirst({ where: { nfc_uid: nfcUid } });
  if (!card) throw Object.assign(new Error('NFC tag not linked to any card'), { status: 404 });
  return scanAttendance(card.card_number, recordedBy, options);
}

async function getTodaySummary(schoolId) {
  const now = new Date();
  const kigaliDateStr = now.toLocaleDateString('en-ZA', { timeZone: 'Africa/Kigali' });
  const today = new Date(kigaliDateStr.replace(/\//g, '-'));
  today.setUTCHours(0, 0, 0, 0);
  const records = await prisma.attendance.findMany({
    where: { school_id: schoolId, date: today },
    select: { status: true, check_in_time: true, student: { select: { user: { select: { first_name: true, last_name: true, profile_photo: true } }, class: { select: { name: true } } } } },
    orderBy: { check_in_time: 'desc' },
  });
  const summary = records.reduce((acc, r) => { acc[r.status] = (acc[r.status] || 0) + 1; return acc; }, { PRESENT: 0, ABSENT: 0, LATE: 0, EXCUSED: 0 });
  return { summary, total: records.length, recent: records.slice(0, 10) };
}

async function scanAttendanceSecure(token, recordedBy, options = {}) {
  if (!token) throw Object.assign(new Error('Token is required'), { status: 400 });

  if (token.startsWith('KS:')) {
    const crypto = require('crypto');
    const parts = token.split(':');
    if (parts.length !== 4) {
      throw Object.assign(new Error('Invalid or corrupted security token.'), { status: 400 });
    }
    const [prefix, cardNumber, expiryStr, signature] = parts;
    const expiry = parseInt(expiryStr, 10);
    if (isNaN(expiry) || Date.now() > expiry) {
      throw Object.assign(new Error('Secure scan token expired. Please refresh QR code.'), { status: 400 });
    }
    // Verify signature
    const message = `${cardNumber}:${expiryStr}`;
    const expectedSig = crypto.createHmac('sha256', process.env.JWT_SECRET)
      .update(message)
      .digest('base64url');
    
    if (signature !== expectedSig) {
      throw Object.assign(new Error('Invalid or corrupted security token.'), { status: 400 });
    }
    return scanAttendance(cardNumber, recordedBy, options);
  }

  const jwt = require('jsonwebtoken');
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (payload.type !== 'virtual_card_attendance') {
      throw new Error('Invalid token type');
    }
    return scanAttendance(payload.card_number, recordedBy, options);
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      throw Object.assign(new Error('Secure scan token expired. Please refresh QR code.'), { status: 400 });
    }
    throw Object.assign(new Error('Invalid or corrupted security token.'), { status: 400 });
  }
}

module.exports = { scanAttendance, bulkMarkAttendance, getStudentAttendance, getClassAttendance, getAttendanceReport, scanAttendanceByNFC, getTodaySummary, scanAttendanceSecure };
