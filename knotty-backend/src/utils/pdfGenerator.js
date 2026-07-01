const PDFDocument = require('pdfkit');
const https = require('https');
const http = require('http');

function fetchImageBuffer(url) {
  return new Promise((resolve) => {
    if (!url) return resolve(null);
    const mod = url.startsWith('https') ? https : http;
    mod.get(url, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', () => resolve(null));
    }).on('error', () => resolve(null));
  });
}

function gradeFromPct(pct) {
  if (pct >= 80) return 'A';
  if (pct >= 75) return 'B';
  if (pct >= 70) return 'C';
  if (pct >= 65) return 'D';
  if (pct >= 50) return 'E';
  if (pct >= 40) return 'S';
  return 'F';
}

// ─── Draw a bordered, optionally filled cell with centred or left-aligned text ─
function drawCell(doc, x, y, w, h, text, opts) {
  const { bold = false, size = 7, align = 'center', bg, color = 'black', vAlign = 'middle' } = opts || {};

  // Background
  if (bg) {
    doc.save().rect(x, y, w, h).fill(bg).restore();
  }
  // Border
  doc.save().rect(x, y, w, h).lineWidth(0.4).stroke('black').restore();

  // Text
  if (text !== null && text !== undefined && String(text).length > 0) {
    doc.save();
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(size).fillColor(color);
    const pad = 2;
    const textH = size * 1.2;
    const textY = vAlign === 'top' ? y + pad :
                  vAlign === 'bottom' ? y + h - textH - pad :
                  y + (h - textH) / 2;
    doc.text(String(text), x + pad, textY, {
      width: w - pad * 2,
      align,
      lineBreak: false,
      ellipsis: true,
    });
    doc.restore();
  }
}

async function generateReportCard(report, student, school) {
  const prisma = require('../config/database');

  // 1. Fetch academic year terms
  const terms = await prisma.academicTerm.findMany({
    where: { school_id: school.id },
    orderBy: { start_date: 'asc' },
  });

  const term1 = terms.find(t => t.name.toLowerCase().includes('term 1') || t.name.toUpperCase().includes('TERM1') || t.name.toLowerCase().includes('t1')) || terms[0];
  const term2 = terms.find(t => t.name.toLowerCase().includes('term 2') || t.name.toUpperCase().includes('TERM2') || t.name.toLowerCase().includes('t2')) || terms[1];
  const term3 = terms.find(t => t.name.toLowerCase().includes('term 3') || t.name.toUpperCase().includes('TERM3') || t.name.toLowerCase().includes('t3')) || terms[2];

  const termIds = terms.map(t => t.id);

  // Fetch all reports for the year to support custom grades extraction
  const allReports = await prisma.academicReport.findMany({
    where: { student_id: student.id, academic_year: report.academic_year },
  });

  const rep1 = allReports.find(r => r.term === 'TERM1');
  const rep2 = allReports.find(r => r.term === 'TERM2');
  const rep3 = allReports.find(r => r.term === 'TERM3');

  // 2. Fetch subjects for student's level
  const dbSubjects = await prisma.subject.findMany({
    where: { school_id: school.id, level_id: student.level_id },
    orderBy: { name: 'asc' },
  });

  // Extract manually entered subjects from the grades JSON
  const customSubjects = new Set();
  [rep1, rep2, rep3].forEach(r => {
    if (r && r.grades && typeof r.grades === 'object') {
      Object.keys(r.grades).forEach(subName => {
        if (r.grades[subName] && typeof r.grades[subName] === 'object') {
          customSubjects.add(subName);
        }
      });
    }
  });

  // Merge DB subjects and custom manual subjects
  const subjectsMap = new Map();
  dbSubjects.forEach(s => subjectsMap.set(s.name.toLowerCase(), { id: s.id, name: s.name }));
  customSubjects.forEach(name => {
    if (!subjectsMap.has(name.toLowerCase())) {
      subjectsMap.set(name.toLowerCase(), { id: `manual-${name.toLowerCase()}`, name });
    }
  });
  const subjects = Array.from(subjectsMap.values());

  // 3. Fetch class students for position calculations
  const classStudents = await prisma.student.findMany({
    where: { class_id: student.class_id, school_id: school.id },
    select: { id: true },
  });
  const studentIds = classStudents.map(s => s.id);

  // 4. Fetch all results for class students in this year
  const allResults = await prisma.examResult.findMany({
    where: {
      student_id: { in: studentIds },
      exam: { academic_term_id: { in: termIds } },
    },
    include: {
      exam: true,
    },
  });

  // 5. Structure scores: studentId -> termId -> subjectId -> { eu: [], pr: [], et: [] }
  const studentScores = {};
  studentIds.forEach(sid => {
    studentScores[sid] = {};
    termIds.forEach(tid => {
      studentScores[sid][tid] = {};
      subjects.forEach(sub => {
        studentScores[sid][tid][sub.id] = { eu: [], pr: [], et: [] };
      });
    });
  });

  allResults.forEach(res => {
    const sid = res.student_id;
    const exam = res.exam;
    if (!exam) return;
    const tid = exam.academic_term_id;
    const subId = exam.subject_id;
    const category = exam.category || 'EU';

    if (studentScores[sid] && studentScores[sid][tid] && studentScores[sid][tid][subId]) {
      studentScores[sid][tid][subId][category.toLowerCase()].push({
        score: res.score,
        max_score: exam.max_score,
      });
    }
  });

  function calcCategoryScore(list, weight) {
    if (!list || list.length === 0) return null;
    const sumPct = list.reduce((sum, item) => sum + (item.score / item.max_score), 0);
    return (sumPct / list.length) * weight;
  }

  function calcSubjectTermTotal(sid, tid, subId) {
    if (!tid) return null;
    const catScores = studentScores[sid]?.[tid]?.[subId];
    if (!catScores) return null;

    const eu = calcCategoryScore(catScores.eu, 25);
    const pr = calcCategoryScore(catScores.pr, 25);
    const et = calcCategoryScore(catScores.et, 50);

    const hasMarks = eu !== null || pr !== null || et !== null;
    return hasMarks ? (eu || 0) + (pr || 0) + (et || 0) : null;
  }

  function calcStudentTermAvg(sid, tid) {
    if (!tid) return null;
    let sum = 0;
    let count = 0;
    subjects.forEach(sub => {
      const tot = calcSubjectTermTotal(sid, tid, sub.id);
      if (tot !== null) {
        sum += tot;
        count++;
      }
    });
    return count > 0 ? sum / count : null;
  }

  function calcStudentAnnualAvg(sid) {
    const t1 = calcStudentTermAvg(sid, term1?.id);
    const t2 = calcStudentTermAvg(sid, term2?.id);
    const t3 = calcStudentTermAvg(sid, term3?.id);
    const active = [t1, t2, t3].filter(t => t !== null);
    return active.length > 0 ? active.reduce((a, b) => a + b, 0) / active.length : null;
  }

  // Position Ranks
  const t1Ranks = studentIds
    .map(sid => ({ sid, avg: calcStudentTermAvg(sid, term1?.id) }))
    .filter(x => x.avg !== null)
    .sort((a, b) => b.avg - a.avg);

  const t2Ranks = studentIds
    .map(sid => ({ sid, avg: calcStudentTermAvg(sid, term2?.id) }))
    .filter(x => x.avg !== null)
    .sort((a, b) => b.avg - a.avg);

  const t3Ranks = studentIds
    .map(sid => ({ sid, avg: calcStudentTermAvg(sid, term3?.id) }))
    .filter(x => x.avg !== null)
    .sort((a, b) => b.avg - a.avg);

  const annualRanks = studentIds
    .map(sid => ({ sid, avg: calcStudentAnnualAvg(sid) }))
    .filter(x => x.avg !== null)
    .sort((a, b) => b.avg - a.avg);

  function getRank(ranks, sid) {
    const index = ranks.findIndex(x => x.sid === sid);
    return index !== -1 ? index + 1 : null;
  }

  // Helper for scoring display formatting
  function formatScore(val) {
    if (val === null || val === undefined) return '';
    return String(Math.round(val * 10) / 10);
  }

  const getSubjectTermMarks = (termNum, subName, subId) => {
    const rep = termNum === 1 ? rep1 : termNum === 2 ? rep2 : rep3;
    const tid = termNum === 1 ? term1?.id : termNum === 2 ? term2?.id : term3?.id;

    const gradesObj = rep && rep.grades && typeof rep.grades === 'object' ? rep.grades : null;
    if (gradesObj) {
      const key = Object.keys(gradesObj).find(k => k.toLowerCase() === subName.toLowerCase());
      if (key && gradesObj[key]) {
        const item = gradesObj[key];
        return {
          eu: item.eu !== undefined && item.eu !== null ? Number(item.eu) : null,
          pr: item.pr !== undefined && item.pr !== null ? Number(item.pr) : null,
          et: item.et !== undefined && item.et !== null ? Number(item.et) : null,
        };
      }
    }

    if (!tid || !subId || subId.startsWith('manual-')) return null;
    const catScores = studentScores[student.id]?.[tid]?.[subId];
    if (!catScores) return null;
    return {
      eu: calcCategoryScore(catScores.eu, 25),
      pr: calcCategoryScore(catScores.pr, 25),
      et: calcCategoryScore(catScores.et, 50),
    };
  };

  const getSubjectTermTotal = (termNum, subName, subId) => {
    const marks = getSubjectTermMarks(termNum, subName, subId);
    if (!marks) return null;
    const hasMarks = marks.eu !== null || marks.pr !== null || marks.et !== null;
    return hasMarks ? (marks.eu || 0) + (marks.pr || 0) + (marks.et || 0) : null;
  };

  // Compile subject rows for target student
  const rows = subjects.map(sub => {
    // Term 1 marks
    const t1_marks = getSubjectTermMarks(1, sub.name, sub.id);
    const t1_eu = t1_marks?.eu ?? null;
    const t1_pr = t1_marks?.pr ?? null;
    const t1_et = t1_marks?.et ?? null;
    const t1_tot = getSubjectTermTotal(1, sub.name, sub.id);
    const t1_pct = t1_tot;
    const t1_gr = t1_tot !== null ? gradeFromPct(t1_tot) : '';

    // Term 2 marks
    const t2_marks = getSubjectTermMarks(2, sub.name, sub.id);
    const t2_eu = t2_marks?.eu ?? null;
    const t2_pr = t2_marks?.pr ?? null;
    const t2_et = t2_marks?.et ?? null;
    const t2_tot = getSubjectTermTotal(2, sub.name, sub.id);
    const t2_pct = t2_tot;
    const t2_gr = t2_tot !== null ? gradeFromPct(t2_tot) : '';

    // Term 3 marks
    const t3_marks = getSubjectTermMarks(3, sub.name, sub.id);
    const t3_eu = t3_marks?.eu ?? null;
    const t3_pr = t3_marks?.pr ?? null;
    const t3_et = t3_marks?.et ?? null;
    const t3_tot = getSubjectTermTotal(3, sub.name, sub.id);
    const t3_pct = t3_tot;
    const t3_gr = t3_tot !== null ? gradeFromPct(t3_tot) : '';

    // Annual marks
    const activeVals = [t1_tot, t2_tot, t3_tot].filter(v => v !== null);
    const annual_tot = activeVals.length > 0 ? activeVals.reduce((a, b) => a + b, 0) / activeVals.length : null;
    const annual_max = activeVals.length > 0 ? 100 : null;
    const annual_pct = annual_tot;
    const annual_gr = annual_tot !== null ? gradeFromPct(annual_tot) : '';

    return {
      name: sub.name,
      t1: { eu: t1_eu, pr: t1_pr, et: t1_et, tot: t1_tot, pct: t1_pct, gr: t1_gr },
      t2: { eu: t2_eu, pr: t2_pr, et: t2_et, tot: t2_tot, pct: t2_pct, gr: t2_gr },
      t3: { eu: t3_eu, pr: t3_pr, et: t3_et, tot: t3_tot, pct: t3_pct, gr: t3_gr },
      annual: { tot: annual_tot, max: annual_max, pct: annual_pct, gr: annual_gr },
    };
  });

  // Gather conduct grades from reports (already loaded at the top)
  function getConductVal(rep) {
    if (!rep || !rep.conduct_grade) return null;
    const num = Number(rep.conduct_grade);
    return isNaN(num) ? rep.conduct_grade : num;
  }
  const c1 = getConductVal(rep1);
  const c2 = getConductVal(rep2);
  const c3 = getConductVal(rep3);

  const cActive = [c1, c2, c3].filter(c => typeof c === 'number');
  const cAnnual = cActive.length > 0 
    ? Math.round(cActive.reduce((a, b) => a + b, 0) / cActive.length) 
    : (c3 || c2 || c1 || null);

  const logoBuffer = school.logo ? await fetchImageBuffer(school.logo) : null;

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 0 });
    const buffers = [];
    doc.on('data', c => buffers.push(c));
    doc.on('end',  () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    const PW = 595.28;
    const ML = 28; // left/right margin
    const MT = 22; // top margin
    const CW = PW - ML * 2; // ≈ 539

    let y = MT;

    // ── 1. HEADER ─────────────────────────────────────────────────────────────
    let logoRight = ML;
    if (logoBuffer) {
      try {
        doc.image(logoBuffer, ML, y, { width: 44, height: 44, fit: [44, 44] });
        logoRight = ML + 50;
      } catch { logoRight = ML; }
    }

    doc.font('Helvetica-Bold').fontSize(7.5).fillColor('black');
    doc.text('REPUBLIC OF RWANDA', logoRight, y);
    doc.text('MINISTRY OF EDUCATION', logoRight, y + 9);
    
    doc.font('Helvetica').fontSize(6.5).fillColor('#333');
    doc.text(`District: ${school.address || '—'}`, logoRight, y + 18);
    doc.text(`School: ${school.name}`, logoRight, y + 26);
    doc.text(`School Code: ${school.code || '—'}`, logoRight, y + 34);
    doc.text(`E-mail/Phone: ${school.email || '—'} / ${school.phone || '—'}`, logoRight, y + 42);

    const titleW = 190;
    const titleX = ML + CW - titleW;
    const titleH = 50;
    doc.rect(titleX, y, titleW, titleH).lineWidth(1.2).stroke('black');
    doc.font('Helvetica-Bold').fontSize(9.5).fillColor('black')
      .text('STUDENT REPORT CARD', titleX, y + 10, { width: titleW, align: 'center' });
    doc.font('Helvetica-Bold').fontSize(8.5)
      .text('ADVANCED LEVEL', titleX, y + 22, { width: titleW, align: 'center' });
    const levelName = student.class?.level?.name || 'Senior Secondary';
    doc.font('Helvetica').fontSize(7)
      .text(levelName, titleX, y + 34, { width: titleW, align: 'center' });

    y += 56;
    doc.moveTo(ML, y).lineTo(ML + CW, y).lineWidth(0.5).stroke('black');
    y += 5;

    // ── 2. STUDENT INFO ────────────────────────────────────────────────────────
    const studentName = `${student.user.first_name} ${student.user.last_name}`.toUpperCase();
    const classInfo   = `${student.class?.level?.name || ''} ${student.class?.name || ''}`.trim();
    const dob = student.date_of_birth
      ? new Date(student.date_of_birth).toLocaleDateString('en-GB')
      : '—';

    const getCombination = (className) => {
      if (!className) return '—';
      const upper = className.toUpperCase();
      if (upper.includes('MPC')) return 'Mathematics-Physics-Computer Science (MPC)';
      if (upper.includes('PCM')) return 'Physics-Chemistry-Mathematics (PCM)';
      if (upper.includes('PCB')) return 'Physics-Chemistry-Biology (PCB)';
      if (upper.includes('MCB')) return 'Mathematics-Chemistry-Biology (MCB)';
      if (upper.includes('MEG')) return 'Mathematics-Economics-Geography (MEG)';
      if (upper.includes('HEG')) return 'History-Economics-Geography (HEG)';
      if (upper.includes('BCG')) return 'Biology-Chemistry-Geography (BCG)';
      if (upper.includes('MPG')) return 'Mathematics-Physics-Geography (MPG)';
      return className;
    };
    const comb = getCombination(student.class?.name);

    doc.font('Helvetica-Bold').fontSize(8).fillColor('black')
      .text(`Student's Names: ${studentName}`, ML, y);
    doc.font('Helvetica').fontSize(7.5)
      .text(`Registration ID: ${student.student_code}`, ML, y + 11)
      .text(`Date of Birth: ${dob}`, ML, y + 21)
      .text(`Combination: ${comb}`, ML, y + 31);

    const rightInfoX = ML + CW - 230;
    doc.font('Helvetica-Bold').fontSize(8).fillColor('black')
      .text(`Academic Year: ${report.academic_year}`, rightInfoX, y);
    doc.font('Helvetica').fontSize(7.5)
      .text(`Class: ${classInfo}`, rightInfoX, y + 11)
      .text(`Gender / Nationality: ${student.gender || '—'} / ${student.nationality || 'Rwandan'}`, rightInfoX, y + 21);

    y += 44;

    // ── 3. GRADE TABLE ─────────────────────────────────────────────────────────
    const wSub = 110;
    const wMax = 70;
    const wT1  = 96;
    const wT2  = 96;
    const wT3  = 96;
    const wAnn = 71;

    const hH = 12;
    const rH = 12;
    const BG_HDR = '#f2f2f2';
    const BG_ALT = '#fafafa';
    const BG_TOT = '#e6e6e6';

    // Header Row 1
    let cx = ML;
    drawCell(doc, cx, y, wSub, hH * 2, 'SUBJECT', { bold: true, size: 7.5, bg: BG_HDR, align: 'center' }); cx += wSub;
    drawCell(doc, cx, y, wMax, hH, 'MAXIMUM', { bold: true, size: 7, bg: BG_HDR, align: 'center' }); cx += wMax;
    drawCell(doc, cx, y, wT1,  hH, 'TERM 1', { bold: true, size: 7, bg: BG_HDR, align: 'center' }); cx += wT1;
    drawCell(doc, cx, y, wT2,  hH, 'TERM 2', { bold: true, size: 7, bg: BG_HDR, align: 'center' }); cx += wT2;
    drawCell(doc, cx, y, wT3,  hH, 'TERM 3', { bold: true, size: 7, bg: BG_HDR, align: 'center' }); cx += wT3;
    drawCell(doc, cx, y, wAnn, hH, 'ANNUAL TOTAL', { bold: true, size: 6.5, bg: BG_HDR, align: 'center' });

    // Header Row 2
    y += hH;
    let cx2 = ML + wSub;
    // MAXIMUM sub-headers
    drawCell(doc, cx2, y, 15, hH, 'EU', { bold: true, size: 6, bg: BG_HDR }); cx2 += 15;
    drawCell(doc, cx2, y, 15, hH, 'PR', { bold: true, size: 6, bg: BG_HDR }); cx2 += 15;
    drawCell(doc, cx2, y, 20, hH, 'ET', { bold: true, size: 6, bg: BG_HDR }); cx2 += 20;
    drawCell(doc, cx2, y, 20, hH, 'TOT', { bold: true, size: 6, bg: BG_HDR }); cx2 += 20;

    // Term 1, 2, 3 sub-headers
    for (let t = 0; t < 3; t++) {
      drawCell(doc, cx2, y, 15, hH, 'EU', { bold: true, size: 6, bg: BG_HDR }); cx2 += 15;
      drawCell(doc, cx2, y, 15, hH, 'PR', { bold: true, size: 6, bg: BG_HDR }); cx2 += 15;
      drawCell(doc, cx2, y, 20, hH, 'ET', { bold: true, size: 6, bg: BG_HDR }); cx2 += 20;
      drawCell(doc, cx2, y, 20, hH, 'TOT', { bold: true, size: 6, bg: BG_HDR }); cx2 += 20;
      drawCell(doc, cx2, y, 14, hH, '%', { bold: true, size: 6, bg: BG_HDR }); cx2 += 14;
      drawCell(doc, cx2, y, 12, hH, 'GR', { bold: true, size: 6, bg: BG_HDR }); cx2 += 12;
    }

    // Annual sub-headers
    drawCell(doc, cx2, y, 20, hH, 'TOT', { bold: true, size: 6, bg: BG_HDR }); cx2 += 20;
    drawCell(doc, cx2, y, 20, hH, 'MAX', { bold: true, size: 6, bg: BG_HDR }); cx2 += 20;
    drawCell(doc, cx2, y, 17, hH, '%', { bold: true, size: 6, bg: BG_HDR }); cx2 += 17;
    drawCell(doc, cx2, y, 14, hH, 'GR', { bold: true, size: 6, bg: BG_HDR });

    y += hH;

    // Subject Rows
    rows.forEach((row, rIdx) => {
      const bg = rIdx % 2 === 1 ? BG_ALT : null;
      let rx = ML;

      // Subject Name
      drawCell(doc, rx, y, wSub, rH, row.name, { size: 6.5, align: 'left', bg }); rx += wSub;

      // MAXIMUM values for subject
      drawCell(doc, rx, y, 15, rH, '25', { size: 6, bg }); rx += 15;
      drawCell(doc, rx, y, 15, rH, '25', { size: 6, bg }); rx += 15;
      drawCell(doc, rx, y, 20, rH, '50', { size: 6, bg }); rx += 20;
      drawCell(doc, rx, y, 20, rH, '100', { size: 6, bg, bold: true }); rx += 20;

      // Term 1 marks
      drawCell(doc, rx, y, 15, rH, formatScore(row.t1.eu), { size: 6, bg }); rx += 15;
      drawCell(doc, rx, y, 15, rH, formatScore(row.t1.pr), { size: 6, bg }); rx += 15;
      drawCell(doc, rx, y, 20, rH, formatScore(row.t1.et), { size: 6, bg }); rx += 20;
      drawCell(doc, rx, y, 20, rH, formatScore(row.t1.tot), { size: 6, bg, bold: true }); rx += 20;
      drawCell(doc, rx, y, 14, rH, row.t1.pct !== null ? `${Math.round(row.t1.pct)}%` : '', { size: 6, bg }); rx += 14;
      drawCell(doc, rx, y, 12, rH, row.t1.gr, { size: 6.5, bg, bold: true }); rx += 12;

      // Term 2 marks
      drawCell(doc, rx, y, 15, rH, formatScore(row.t2.eu), { size: 6, bg }); rx += 15;
      drawCell(doc, rx, y, 15, rH, formatScore(row.t2.pr), { size: 6, bg }); rx += 15;
      drawCell(doc, rx, y, 20, rH, formatScore(row.t2.et), { size: 6, bg }); rx += 20;
      drawCell(doc, rx, y, 20, rH, formatScore(row.t2.tot), { size: 6, bg, bold: true }); rx += 20;
      drawCell(doc, rx, y, 14, rH, row.t2.pct !== null ? `${Math.round(row.t2.pct)}%` : '', { size: 6, bg }); rx += 14;
      drawCell(doc, rx, y, 12, rH, row.t2.gr, { size: 6.5, bg, bold: true }); rx += 12;

      // Term 3 marks
      drawCell(doc, rx, y, 15, rH, formatScore(row.t3.eu), { size: 6, bg }); rx += 15;
      drawCell(doc, rx, y, 15, rH, formatScore(row.t3.pr), { size: 6, bg }); rx += 15;
      drawCell(doc, rx, y, 20, rH, formatScore(row.t3.et), { size: 6, bg }); rx += 20;
      drawCell(doc, rx, y, 20, rH, formatScore(row.t3.tot), { size: 6, bg, bold: true }); rx += 20;
      drawCell(doc, rx, y, 14, rH, row.t3.pct !== null ? `${Math.round(row.t3.pct)}%` : '', { size: 6, bg }); rx += 14;
      drawCell(doc, rx, y, 12, rH, row.t3.gr, { size: 6.5, bg, bold: true }); rx += 12;

      // Annual marks
      drawCell(doc, rx, y, 20, rH, formatScore(row.annual.tot), { size: 6, bg, bold: true }); rx += 20;
      drawCell(doc, rx, y, 20, rH, row.annual.max ? String(row.annual.max) : '', { size: 6, bg }); rx += 20;
      drawCell(doc, rx, y, 17, rH, row.annual.pct !== null ? `${Math.round(row.annual.pct)}%` : '', { size: 6, bg }); rx += 17;
      drawCell(doc, rx, y, 14, rH, row.annual.gr, { size: 6.5, bg, bold: true });

      y += rH;
    });

    // Conduct row
    let rcx = ML;
    drawCell(doc, rcx, y, wSub, rH, 'Conduct', { size: 6.5, align: 'left', bold: true }); rcx += wSub;
    drawCell(doc, rcx, y, 15, rH, '', { bg: BG_ALT }); rcx += 15;
    drawCell(doc, rcx, y, 15, rH, '', { bg: BG_ALT }); rcx += 15;
    drawCell(doc, rcx, y, 20, rH, '', { bg: BG_ALT }); rcx += 20;
    drawCell(doc, rcx, y, 20, rH, '40', { size: 6, bg: BG_ALT, bold: true }); rcx += 20;

    // Term 1 Conduct
    drawCell(doc, rcx, y, 15, rH, '', { }); rcx += 15;
    drawCell(doc, rcx, y, 15, rH, '', { }); rcx += 15;
    drawCell(doc, rcx, y, 20, rH, '', { }); rcx += 20;
    drawCell(doc, rcx, y, 20, rH, c1 !== null ? String(c1) : '', { size: 6, bold: true }); rcx += 20;
    drawCell(doc, rcx, y, 14, rH, '', { }); rcx += 14;
    drawCell(doc, rcx, y, 12, rH, '', { }); rcx += 12;

    // Term 2 Conduct
    drawCell(doc, rcx, y, 15, rH, '', { }); rcx += 15;
    drawCell(doc, rcx, y, 15, rH, '', { }); rcx += 15;
    drawCell(doc, rcx, y, 20, rH, '', { }); rcx += 20;
    drawCell(doc, rcx, y, 20, rH, c2 !== null ? String(c2) : '', { size: 6, bold: true }); rcx += 20;
    drawCell(doc, rcx, y, 14, rH, '', { }); rcx += 14;
    drawCell(doc, rcx, y, 12, rH, '', { }); rcx += 12;

    // Term 3 Conduct
    drawCell(doc, rcx, y, 15, rH, '', { }); rcx += 15;
    drawCell(doc, rcx, y, 15, rH, '', { }); rcx += 15;
    drawCell(doc, rcx, y, 20, rH, '', { }); rcx += 20;
    drawCell(doc, rcx, y, 20, rH, c3 !== null ? String(c3) : '', { size: 6, bold: true }); rcx += 20;
    drawCell(doc, rcx, y, 14, rH, '', { }); rcx += 14;
    drawCell(doc, rcx, y, 12, rH, '', { }); rcx += 12;

    // Annual Conduct
    drawCell(doc, rcx, y, 20, rH, cAnnual !== null ? String(cAnnual) : '', { size: 6, bold: true }); rcx += 20;
    drawCell(doc, rcx, y, 20, rH, '40', { size: 6 }); rcx += 20;
    drawCell(doc, rcx, y, 17, rH, '', { }); rcx += 17;
    drawCell(doc, rcx, y, 14, rH, '', { });

    y += rH;

    // Totals calculations
    const activeT1 = rows.filter(r => r.t1.tot !== null);
    const t1TotSum = activeT1.length > 0 ? activeT1.reduce((sum, r) => sum + r.t1.tot, 0) : null;

    const activeT2 = rows.filter(r => r.t2.tot !== null);
    const t2TotSum = activeT2.length > 0 ? activeT2.reduce((sum, r) => sum + r.t2.tot, 0) : null;

    const activeT3 = rows.filter(r => r.t3.tot !== null);
    const t3TotSum = activeT3.length > 0 ? activeT3.reduce((sum, r) => sum + r.t3.tot, 0) : null;

    const activeAnn = rows.filter(r => r.annual.tot !== null);
    const annTotSum = activeAnn.length > 0 ? activeAnn.reduce((sum, r) => sum + r.annual.tot, 0) : null;
    const annMaxSum = activeAnn.length > 0 ? activeAnn.length * 100 : null;

    // Total row
    let rtx = ML;
    drawCell(doc, rtx, y, wSub, rH, 'Total', { size: 6.5, align: 'left', bold: true, bg: BG_TOT }); rtx += wSub;
    drawCell(doc, rtx, y, 15, rH, '', { bg: BG_TOT }); rtx += 15;
    drawCell(doc, rtx, y, 15, rH, '', { bg: BG_TOT }); rtx += 15;
    drawCell(doc, rtx, y, 20, rH, '', { bg: BG_TOT }); rtx += 20;
    drawCell(doc, rtx, y, 20, rH, subjects.length > 0 ? String(subjects.length * 100) : '', { size: 6, bg: BG_TOT, bold: true }); rtx += 20;

    // Term 1 Totals
    drawCell(doc, rtx, y, 15, rH, '', { bg: BG_TOT }); rtx += 15;
    drawCell(doc, rtx, y, 15, rH, '', { bg: BG_TOT }); rtx += 15;
    drawCell(doc, rtx, y, 20, rH, '', { bg: BG_TOT }); rtx += 20;
    drawCell(doc, rtx, y, 20, rH, formatScore(t1TotSum), { size: 6, bg: BG_TOT, bold: true }); rtx += 20;
    drawCell(doc, rtx, y, 14, rH, '', { bg: BG_TOT }); rtx += 14;
    drawCell(doc, rtx, y, 12, rH, '', { bg: BG_TOT }); rtx += 12;

    // Term 2 Totals
    drawCell(doc, rtx, y, 15, rH, '', { bg: BG_TOT }); rtx += 15;
    drawCell(doc, rtx, y, 15, rH, '', { bg: BG_TOT }); rtx += 15;
    drawCell(doc, rtx, y, 20, rH, '', { bg: BG_TOT }); rtx += 20;
    drawCell(doc, rtx, y, 20, rH, formatScore(t2TotSum), { size: 6, bg: BG_TOT, bold: true }); rtx += 20;
    drawCell(doc, rtx, y, 14, rH, '', { bg: BG_TOT }); rtx += 14;
    drawCell(doc, rtx, y, 12, rH, '', { bg: BG_TOT }); rtx += 12;

    // Term 3 Totals
    drawCell(doc, rtx, y, 15, rH, '', { bg: BG_TOT }); rtx += 15;
    drawCell(doc, rtx, y, 15, rH, '', { bg: BG_TOT }); rtx += 15;
    drawCell(doc, rtx, y, 20, rH, '', { bg: BG_TOT }); rtx += 20;
    drawCell(doc, rtx, y, 20, rH, formatScore(t3TotSum), { size: 6, bg: BG_TOT, bold: true }); rtx += 20;
    drawCell(doc, rtx, y, 14, rH, '', { bg: BG_TOT }); rtx += 14;
    drawCell(doc, rtx, y, 12, rH, '', { bg: BG_TOT }); rtx += 12;

    // Annual Totals
    drawCell(doc, rtx, y, 20, rH, formatScore(annTotSum), { size: 6, bg: BG_TOT, bold: true }); rtx += 20;
    drawCell(doc, rtx, y, 20, rH, annMaxSum ? String(annMaxSum) : '', { size: 6, bg: BG_TOT }); rtx += 20;
    drawCell(doc, rtx, y, 17, rH, '', { bg: BG_TOT }); rtx += 17;
    drawCell(doc, rtx, y, 14, rH, '', { bg: BG_TOT });

    y += rH;

    // Percentage averages
    const getStudentTermAvg = (rep, termNum) => {
      if (rep && rep.average !== null && rep.average !== undefined) {
        return rep.average;
      }
      let sum = 0;
      let count = 0;
      rows.forEach(r => {
        const tot = termNum === 1 ? r.t1.tot : termNum === 2 ? r.t2.tot : r.t3.tot;
        if (tot !== null) {
          sum += tot;
          count++;
        }
      });
      return count > 0 ? sum / count : null;
    };

    const t1Avg = getStudentTermAvg(rep1, 1);
    const t2Avg = getStudentTermAvg(rep2, 2);
    const t3Avg = getStudentTermAvg(rep3, 3);

    const getStudentAnnualAvg = () => {
      const active = [t1Avg, t2Avg, t3Avg].filter(t => t !== null);
      return active.length > 0 ? active.reduce((a, b) => a + b, 0) / active.length : null;
    };
    const annAvg = getStudentAnnualAvg();

    // Percentage row
    let rpx = ML;
    drawCell(doc, rpx, y, wSub, rH, 'Percentage', { size: 6.5, align: 'left', bold: true }); rpx += wSub;
    drawCell(doc, rpx, y, 15, rH, '', { bg: BG_ALT }); rpx += 15;
    drawCell(doc, rpx, y, 15, rH, '', { bg: BG_ALT }); rpx += 15;
    drawCell(doc, rpx, y, 20, rH, '', { bg: BG_ALT }); rpx += 20;
    drawCell(doc, rpx, y, 20, rH, '100%', { size: 6, bg: BG_ALT, bold: true }); rpx += 20;

    // Term 1 Percentage
    drawCell(doc, rpx, y, 15, rH, '', { }); rpx += 15;
    drawCell(doc, rpx, y, 15, rH, '', { }); rpx += 15;
    drawCell(doc, rpx, y, 20, rH, '', { }); rpx += 20;
    drawCell(doc, rpx, y, 20, rH, t1Avg !== null ? `${Math.round(t1Avg * 10) / 10}%` : '', { size: 6.5, bold: true }); rpx += 20;
    drawCell(doc, rpx, y, 14, rH, '', { }); rpx += 14;
    drawCell(doc, rpx, y, 12, rH, '', { }); rpx += 12;

    // Term 2 Percentage
    drawCell(doc, rpx, y, 15, rH, '', { }); rpx += 15;
    drawCell(doc, rpx, y, 15, rH, '', { }); rpx += 15;
    drawCell(doc, rpx, y, 20, rH, '', { }); rpx += 20;
    drawCell(doc, rpx, y, 20, rH, t2Avg !== null ? `${Math.round(t2Avg * 10) / 10}%` : '', { size: 6.5, bold: true }); rpx += 20;
    drawCell(doc, rpx, y, 14, rH, '', { }); rpx += 14;
    drawCell(doc, rpx, y, 12, rH, '', { }); rpx += 12;

    // Term 3 Percentage
    drawCell(doc, rpx, y, 15, rH, '', { }); rpx += 15;
    drawCell(doc, rpx, y, 15, rH, '', { }); rpx += 15;
    drawCell(doc, rpx, y, 20, rH, '', { }); rpx += 20;
    drawCell(doc, rpx, y, 20, rH, t3Avg !== null ? `${Math.round(t3Avg * 10) / 10}%` : '', { size: 6.5, bold: true }); rpx += 20;
    drawCell(doc, rpx, y, 14, rH, '', { }); rpx += 14;
    drawCell(doc, rpx, y, 12, rH, '', { }); rpx += 12;

    // Annual Percentage
    drawCell(doc, rpx, y, 20, rH, annAvg !== null ? `${Math.round(annAvg * 10) / 10}%` : '', { size: 6.5, bold: true }); rpx += 20;
    drawCell(doc, rpx, y, 20, rH, '100%', { size: 6 }); rpx += 20;
    drawCell(doc, rpx, y, 17, rH, '', { }); rpx += 17;
    drawCell(doc, rpx, y, 14, rH, '', { });

    y += rH;

    // Final Grade row
    let rgx = ML;
    drawCell(doc, rgx, y, wSub, rH, 'Final Grade', { size: 6.5, align: 'left', bold: true, bg: BG_ALT }); rgx += wSub;
    drawCell(doc, rgx, y, wMax, rH, '', { bg: BG_ALT }); rgx += wMax;

    // Term 1 Final Grade
    drawCell(doc, rgx, y, 96, rH, t1Avg !== null ? gradeFromPct(t1Avg) : '', { size: 7.5, bold: true, bg: BG_ALT }); rgx += 96;

    // Term 2 Final Grade
    drawCell(doc, rgx, y, 96, rH, t2Avg !== null ? gradeFromPct(t2Avg) : '', { size: 7.5, bold: true, bg: BG_ALT }); rgx += 96;

    // Term 3 Final Grade
    drawCell(doc, rgx, y, 96, rH, t3Avg !== null ? gradeFromPct(t3Avg) : '', { size: 7.5, bold: true, bg: BG_ALT }); rgx += 96;

    // Annual Final Grade
    drawCell(doc, rgx, y, wAnn, rH, annAvg !== null ? gradeFromPct(annAvg) : '', { size: 8, bold: true, bg: BG_ALT });

    y += rH;

    // Position calculations
    const classTotal = studentIds.length || 0;
    const t1Pos = rep1?.position_in_class || getRank(t1Ranks, student.id);
    const t2Pos = rep2?.position_in_class || getRank(t2Ranks, student.id);
    const t3Pos = rep3?.position_in_class || getRank(t3Ranks, student.id);
    const annPos = report.position_in_class || getRank(annualRanks, student.id);

    // Position row
    let rpos = ML;
    drawCell(doc, rpos, y, wSub, rH, 'Position', { size: 6.5, align: 'left', bold: true }); rpos += wSub;
    drawCell(doc, rpos, y, wMax, rH, '', { }); rpos += wMax;

    // Term 1 Position
    drawCell(doc, rpos, y, 96, rH, t1Pos ? `${t1Pos} out of ${classTotal}` : '', { size: 6.5 }); rpos += 96;

    // Term 2 Position
    drawCell(doc, rpos, y, 96, rH, t2Pos ? `${t2Pos} out of ${classTotal}` : '', { size: 6.5 }); rpos += 96;

    // Term 3 Position
    drawCell(doc, rpos, y, 96, rH, t3Pos ? `${t3Pos} out of ${classTotal}` : '', { size: 6.5 }); rpos += 96;

    // Annual Position
    drawCell(doc, rpos, y, wAnn, rH, annPos ? `${annPos} / ${classTotal}` : '', { size: 7, bold: true });

    y += rH + 4;

    // ── 4. COMMENT ────────────────────────────────────────────────────────────
    const commentH = 34;
    const commentLabelW = 60;
    const commentText = [
      rep1?.teacher_remarks ? `T1: ${rep1.teacher_remarks}` : '',
      rep2?.teacher_remarks ? `T2: ${rep2.teacher_remarks}` : '',
      rep3?.teacher_remarks ? `T3: ${rep3.teacher_remarks}` : '',
    ].filter(Boolean).join('  |  ') || '—';
    drawCell(doc, ML, y, commentLabelW, commentH, 'Comment', { bold: true, size: 7, bg: BG_ALT, align: 'left', vAlign: 'top' });
    drawCell(doc, ML + commentLabelW, y, CW - commentLabelW, commentH, commentText, { size: 6.5, align: 'left', vAlign: 'top' });
    y += commentH + 4;

    // ── 5. SIGNATURES ─────────────────────────────────────────────────────────
    const sigH = 30;
    const sigW = CW / 2;
    drawCell(doc, ML,        y, sigW, sigH, "Class Teacher's Signature", { bold: true, size: 7, vAlign: 'top' });
    drawCell(doc, ML + sigW, y, sigW, sigH, "Parent's Signature",        { bold: true, size: 7, vAlign: 'top' });
    y += sigH + 4;

    // ── 6. GRADING SCALE ──────────────────────────────────────────────────────
    const scaleRows = [
      { label: 'Final Grade',  values: ['100-80', '79-75', '74-70', '69-65', '64-50', '49-40', '39-00'] },
      { label: 'Letter Grade', values: ['A', 'B', 'C', 'D', 'E', 'S', 'F'] },
      { label: 'Grade Value',  values: ['6', '5', '4', '3', '2', '1', '0'] },
    ];
    const scH = 11;
    const scLabelW = 70;
    const scValW = (CW - scLabelW) / 7;

    drawCell(doc, ML, y, scLabelW, scH * 3, 'Grading\nscale', { bold: true, size: 7, bg: BG_HDR, align: 'center' });
    scaleRows.forEach((sr, ri) => {
      drawCell(doc, ML + scLabelW, y + ri * scH, 70, scH, sr.label, { bold: true, size: 6.5, bg: '#E8E8E8', align: 'left' });
      sr.values.forEach((v, vi) => {
        drawCell(doc, ML + scLabelW + 70 + vi * scValW, y + ri * scH, scValW, scH, v, { size: 6.5, align: 'center' });
      });
    });
    y += scH * 3 + 4;

    // ── 7. FOOTER ─────────────────────────────────────────────────────────────
    const footH = 52;
    // Abbreviations (left)
    const abbW = 175;
    const abbLines = [
      'EU : End of Unit Assessment',
      'PR : Projects Assessment',
      'ET : End of Term Assessment',
      'GR : Letter grade',
      'TOT: Total',
      'MAX: Maximum marks',
    ].join('\n');
    drawCell(doc, ML, y, abbW, footH, abbLines, { size: 5.8, align: 'left', vAlign: 'top' });

    // Headteacher (centre)
    const htW = CW - abbW - 110;
    const htX = ML + abbW;
    drawCell(doc, htX, y,      htW, 18, 'HEADTEACHER', { bold: true, size: 8, align: 'center', bg: BG_ALT });
    drawCell(doc, htX, y + 18, htW, 17, `Signature: ${'_'.repeat(22)}`, { size: 7, align: 'center' });
    drawCell(doc, htX, y + 35, htW, 17, new Date().toLocaleDateString('en-GB'), { size: 7, align: 'center' });

    // Generated by box (right)
    const genX = ML + CW - 110;
    drawCell(doc, genX, y, 110, footH, `Generated by\nKNOTTY Smart\nSchool System`, { size: 6.5, align: 'center', color: '#555' });

    doc.end();
  });
}

async function generateAttendancePDF(classInfo, allStudents, attendanceMap, dateStr, school) {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 36, bufferPages: true });
      const chunks = [];
      doc.on('data', (c) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const PAGE_W = doc.page.width - 72;
      const LEFT = 36;

      // ── Header ────────────────────────────────────────────────
      const logoBuffer = await fetchImageBuffer(school.logo);
      if (logoBuffer) {
        doc.image(logoBuffer, LEFT, 36, { width: 44, height: 44 });
        doc.y = 36;
      }

      const headerX = logoBuffer ? LEFT + 52 : LEFT;
      doc.font('Helvetica-Bold').fontSize(13).fillColor('#111')
        .text(school.name || 'School', headerX, 36, { width: PAGE_W - (logoBuffer ? 52 : 0) });
      doc.font('Helvetica').fontSize(8).fillColor('#555')
        .text(`${school.address || ''} ${school.phone ? '| ' + school.phone : ''}`.trim(), headerX, doc.y + 1);

      // Sub-title
      const levelName = classInfo.level?.name || '';
      const className = `${levelName} ${classInfo.name}`.trim();
      const fmtDate = new Date(dateStr).toLocaleDateString('en-RW', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

      doc.moveDown(0.5);
      const titleY = Math.max(doc.y, logoBuffer ? 88 : doc.y);
      doc.y = titleY;

      doc.save().rect(LEFT, doc.y, PAGE_W, 24).fill('#111').restore();
      doc.font('Helvetica-Bold').fontSize(10).fillColor('#fff')
        .text(`ATTENDANCE REPORT — ${className}`, LEFT + 8, doc.y + 7, { width: PAGE_W - 16, align: 'left', lineBreak: false });
      doc.font('Helvetica').fontSize(8).fillColor('#ccc')
        .text(fmtDate, LEFT + 8, titleY + 7, { width: PAGE_W - 16, align: 'right', lineBreak: false });
      doc.y = titleY + 24 + 6;

      // ── Table ─────────────────────────────────────────────────
      const COL = [22, 30, 120, 62, 62, 50, 50, PAGE_W - 396];
      // #  | Code | Name | Status | Check-In | Check-Out | Note
      const headers = ['#', 'Code', 'Student Name', 'Status', 'Check-In', 'Check-Out', 'Note'];
      const ROW_H = 14;
      const HEAD_H = 16;

      // Header row
      let cx = LEFT;
      const headY = doc.y;
      [COL[0], COL[1], COL[2], COL[3], COL[4], COL[5], COL[6], COL[7]].forEach((w, i) => {
        if (i < headers.length) {
          drawCell(doc, cx, headY, w, HEAD_H, headers[i], { bold: true, size: 7, bg: '#222', color: '#fff', align: i <= 1 ? 'center' : 'left' });
          cx += w;
        }
      });
      doc.y = headY + HEAD_H;

      const STATUS_COLORS = {
        PRESENT: { bg: '#f0fdf4', text: '#16a34a' },
        LATE:    { bg: '#fff7ed', text: '#c2410c' },
        ABSENT:  { bg: '#fef2f2', text: '#dc2626' },
        EXCUSED: { bg: '#eff6ff', text: '#2563eb' },
      };

      function fmtTime(dt) {
        if (!dt) return '—';
        return new Date(dt).toLocaleTimeString('en-RW', { hour: '2-digit', minute: '2-digit', hour12: false });
      }

      allStudents.forEach((student, idx) => {
        const rec = attendanceMap[student.id] || null;
        const status = rec ? rec.status : 'ABSENT';
        const cols_values = STATUS_COLORS[status] || STATUS_COLORS.ABSENT;
        const rowBg = idx % 2 === 0 ? cols_values.bg : '#fafafa';

        if (doc.y + ROW_H > doc.page.height - 60) {
          doc.addPage();
          // Repeat header
          cx = LEFT;
          const ry = doc.y;
          [COL[0], COL[1], COL[2], COL[3], COL[4], COL[5], COL[6], COL[7]].forEach((w, i) => {
            if (i < headers.length) {
              drawCell(doc, cx, ry, w, HEAD_H, headers[i], { bold: true, size: 7, bg: '#222', color: '#fff', align: i <= 1 ? 'center' : 'left' });
              cx += w;
            }
          });
          doc.y = ry + HEAD_H;
        }

        const rowY = doc.y;
        const name = `${student.user.first_name} ${student.user.last_name}`;
        cx = LEFT;
        const rowCols = [COL[0], COL[1], COL[2], COL[3], COL[4], COL[5], COL[7]];
        const rowData = [
          String(idx + 1),
          student.student_code,
          name,
          status,
          rec ? fmtTime(rec.check_in_time) : '—',
          rec ? fmtTime(rec.check_out_time) : '—',
          rec?.note || '',
        ];
        rowCols.forEach((w, i) => {
          const isStatus = i === 3;
          drawCell(doc, cx, rowY, w, ROW_H, rowData[i], {
            size: 7,
            bg: isStatus ? cols_values.bg : rowBg,
            color: isStatus ? cols_values.text : '#333',
            bold: isStatus,
            align: i <= 1 ? 'center' : 'left',
          });
          cx += w;
        });
        doc.y = rowY + ROW_H;
      });

      // ── Summary footer ────────────────────────────────────────
      doc.moveDown(1);
      const summary = allStudents.reduce((acc, s) => {
        const st = attendanceMap[s.id]?.status || 'ABSENT';
        acc[st] = (acc[st] || 0) + 1;
        return acc;
      }, { PRESENT: 0, LATE: 0, ABSENT: 0, EXCUSED: 0 });

      const sumY = doc.y;
      const sumW = 80;
      const sumItems = [
        { label: 'Present', value: summary.PRESENT, bg: '#f0fdf4', color: '#16a34a' },
        { label: 'Late',    value: summary.LATE,    bg: '#fff7ed', color: '#c2410c' },
        { label: 'Absent',  value: summary.ABSENT,  bg: '#fef2f2', color: '#dc2626' },
        { label: 'Excused', value: summary.EXCUSED, bg: '#eff6ff', color: '#2563eb' },
        { label: 'Total',   value: allStudents.length, bg: '#f1f5f9', color: '#111' },
      ];
      let sx = LEFT;
      sumItems.forEach(({ label, value, bg, color }) => {
        doc.save().rect(sx, sumY, sumW, 28).fill(bg).restore();
        doc.save().rect(sx, sumY, sumW, 28).lineWidth(0.4).stroke('#ccc').restore();
        doc.font('Helvetica-Bold').fontSize(14).fillColor(color).text(String(value), sx + 4, sumY + 3, { width: sumW - 8, align: 'center', lineBreak: false });
        doc.font('Helvetica').fontSize(7).fillColor('#555').text(label, sx + 4, sumY + 18, { width: sumW - 8, align: 'center', lineBreak: false });
        sx += sumW + 4;
      });

      // Generated-by line
      doc.y = sumY + 36;
      doc.font('Helvetica').fontSize(7).fillColor('#aaa')
        .text(`Generated by KNOTTY — ${new Date().toLocaleString('en-RW')}`, LEFT, doc.y, { align: 'left' });

      doc.end();
    } catch (e) {
      reject(e);
    }
  });
}

module.exports = { generateReportCard, generateAttendancePDF };
