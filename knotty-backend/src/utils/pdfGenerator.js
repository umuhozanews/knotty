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
  const gradesRaw = typeof report.grades === 'string' ? JSON.parse(report.grades) : (report.grades || {});
  const meta = gradesRaw._meta || {};
  const decision = meta.decision || null;

  const subjectEntries = Object.entries(gradesRaw).filter(([k]) => !k.startsWith('_'));

  const rows = subjectEntries.map(([name, g]) => {
    const cat    = Number(g.cat ?? 0);
    const exam   = Number(g.exam ?? 0);
    const maxCat  = Number(g.max_cat ?? 30);
    const maxExam = Number(g.max_exam ?? 70);
    const total    = cat + exam;
    const maxTotal = maxCat + maxExam;
    const pct   = maxTotal > 0 ? Math.round((total / maxTotal) * 100) : 0;
    const grade = g.grade || gradeFromPct(pct);
    return { name, cat, exam, total, maxCat, maxExam, maxTotal, pct, grade };
  });

  const totalCat    = rows.reduce((a, r) => a + r.cat, 0);
  const totalExam   = rows.reduce((a, r) => a + r.exam, 0);
  const totalAll    = rows.reduce((a, r) => a + r.total, 0);
  const totalMaxCat  = rows.reduce((a, r) => a + r.maxCat, 0);
  const totalMaxExam = rows.reduce((a, r) => a + r.maxExam, 0);
  const totalMaxAll  = rows.reduce((a, r) => a + r.maxTotal, 0);
  const overallPct   = totalMaxAll > 0 ? Math.round((totalAll / totalMaxAll) * 1000) / 10 : 0;
  const overallGrade = gradeFromPct(overallPct);

  const firstRow = rows[0] || { maxCat: 30, maxExam: 70, maxTotal: 100 };
  const catWeight  = Math.round((firstRow.maxCat  / firstRow.maxTotal) * 100);
  const examWeight = Math.round((firstRow.maxExam / firstRow.maxTotal) * 100);

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
    //  Left block: school info lines
    let logoRight = ML;
    if (logoBuffer) {
      try {
        doc.image(logoBuffer, ML, y, { width: 52, height: 52, fit: [52, 52] });
        logoRight = ML + 57;
      } catch { logoRight = ML; }
    }

    const infoLines = [
      { t: 'REPUBLIC OF RWANDA',      bold: true,  size: 7   },
      { t: 'MINISTRY OF EDUCATION',   bold: true,  size: 7   },
      { t: `School: ${school.name}`,  bold: false, size: 6.5 },
      { t: `School Code: ${school.code || '—'}`,    bold: false, size: 6 },
      { t: `E-mail: ${school.email || '—'}`,        bold: false, size: 6 },
      { t: `Phone: ${school.phone || '—'}`,         bold: false, size: 6 },
    ];
    infoLines.forEach((l, i) => {
      doc.font(l.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(l.size).fillColor('black');
      doc.text(l.t, logoRight, y + i * 9, { width: 210, lineBreak: false });
    });

    // Right block: bordered title box
    const titleW = 190;
    const titleX = ML + CW - titleW;
    const titleH = 55;
    doc.rect(titleX, y, titleW, titleH).lineWidth(1.2).stroke('black');
    doc.font('Helvetica-Bold').fontSize(11).fillColor('black')
      .text('STUDENT REPORT CARD:', titleX, y + 10, { width: titleW, align: 'center' });
    doc.font('Helvetica-Bold').fontSize(10)
      .text('ADVANCED LEVEL', titleX, y + 25, { width: titleW, align: 'center' });
    const levelName = student.class?.level?.name || '';
    if (levelName) {
      doc.font('Helvetica').fontSize(7.5).fillColor('#333')
        .text(levelName, titleX, y + 42, { width: titleW, align: 'center' });
    }

    y += 60;

    // Thin separator
    doc.moveTo(ML, y).lineTo(ML + CW, y).lineWidth(0.5).stroke('black');
    y += 4;

    // ── 2. STUDENT INFO ────────────────────────────────────────────────────────
    const studentName = `${student.user.first_name} ${student.user.last_name}`.toUpperCase();
    const classInfo   = `${student.class?.level?.name || ''} ${student.class?.name || ''}`.trim();
    const termLabel   = report.term.replace('TERM', 'Term ');
    const dob = student.date_of_birth
      ? new Date(student.date_of_birth).toLocaleDateString('en-GB')
      : null;

    doc.font('Helvetica-Bold').fontSize(8).fillColor('black')
      .text(`Names: ${studentName}`, ML, y);
    doc.font('Helvetica').fontSize(7.5)
      .text(`Registration ID: ${student.student_code}`, ML, y + 11);
    if (dob) {
      doc.text(`Date of Birth: ${dob}`, ML, y + 22);
    }

    const rightInfoX = ML + CW - 230;
    doc.font('Helvetica-Bold').fontSize(7.5).fillColor('black')
      .text(`Academic Year: ${report.academic_year}`, rightInfoX, y, { width: 230 });
    doc.font('Helvetica').fontSize(7.5)
      .text(`Class: ${classInfo}`, rightInfoX, y + 11, { width: 230 })
      .text(`Term: ${termLabel}`, rightInfoX, y + 22, { width: 230 });

    y += 36;

    // ── 3. GRADE TABLE ─────────────────────────────────────────────────────────
    // Columns: SUBJECT | MAX | CAT | EXAM | TOTAL | % | GR
    // Total CW ≈ 539
    const cSub  = 152;
    const cMax  = 36;
    const cCat  = 62;
    const cExam = 62;
    const cTot  = 62;
    const cPct  = 62;
    const cGr   = CW - cSub - cMax - cCat - cExam - cTot - cPct; // ~103 → trim
    // Force a sensible cGr
    const colWidths = { sub: 155, max: 38, cat: 61, exam: 61, tot: 61, pct: 61, gr: CW - 155 - 38 - 61 - 61 - 61 - 61 }; // gr≈101

    const rH  = 14;  // row height
    const hH  = 13;  // header row height
    const BG_HDR  = '#D3D3D3'; // column header background
    const BG_ALT  = '#F5F5F5'; // alternate row
    const BG_TOT  = '#E0E0E0'; // totals row

    // ── Header row 1: column group labels ─────────────────────────────────────
    let cx = ML;
    // SUBJECT spans 2 header rows
    drawCell(doc, cx, y, colWidths.sub, hH * 2, 'SUBJECT', { bold: true, size: 8, bg: BG_HDR, align: 'center' });
    cx += colWidths.sub;
    drawCell(doc, cx, y, colWidths.max, hH * 2, 'MAX', { bold: true, size: 7, bg: BG_HDR, align: 'center' });
    cx += colWidths.max;
    // Term label spanning remaining 5 columns
    const termSpan = colWidths.cat + colWidths.exam + colWidths.tot + colWidths.pct + colWidths.gr;
    drawCell(doc, cx, y, termSpan, hH, termLabel.toUpperCase(), { bold: true, size: 8, bg: BG_HDR, align: 'center' });

    // Header row 2: sub-column labels
    let cx2 = ML + colWidths.sub + colWidths.max;
    drawCell(doc, cx2, y + hH, colWidths.cat,  hH, 'CAT',   { bold: true, size: 7, bg: '#E8E8E8', align: 'center' }); cx2 += colWidths.cat;
    drawCell(doc, cx2, y + hH, colWidths.exam, hH, 'EXAM',  { bold: true, size: 7, bg: '#E8E8E8', align: 'center' }); cx2 += colWidths.exam;
    drawCell(doc, cx2, y + hH, colWidths.tot,  hH, 'TOTAL', { bold: true, size: 7, bg: '#E8E8E8', align: 'center' }); cx2 += colWidths.tot;
    drawCell(doc, cx2, y + hH, colWidths.pct,  hH, '%',     { bold: true, size: 7, bg: '#E8E8E8', align: 'center' }); cx2 += colWidths.pct;
    drawCell(doc, cx2, y + hH, colWidths.gr,   hH, 'GR',    { bold: true, size: 7, bg: '#E8E8E8', align: 'center' });
    y += hH * 2;

    // ── WEIGHT row ─────────────────────────────────────────────────────────────
    cx = ML;
    drawCell(doc, cx, y, colWidths.sub, rH, 'WEIGHT', { bold: true, size: 6.5, bg: BG_HDR, align: 'left' });  cx += colWidths.sub;
    drawCell(doc, cx, y, colWidths.max, rH, '100%',   { bold: true, size: 6.5, bg: BG_HDR, align: 'center' }); cx += colWidths.max;
    drawCell(doc, cx, y, colWidths.cat, rH, `${catWeight}%`,  { bold: true, size: 6.5, bg: BG_HDR, align: 'center' }); cx += colWidths.cat;
    drawCell(doc, cx, y, colWidths.exam,rH, `${examWeight}%`, { bold: true, size: 6.5, bg: BG_HDR, align: 'center' }); cx += colWidths.exam;
    drawCell(doc, cx, y, colWidths.tot, rH, '100%',  { bold: true, size: 6.5, bg: BG_HDR, align: 'center' }); cx += colWidths.tot;
    drawCell(doc, cx, y, colWidths.pct, rH, '',      { bg: BG_HDR }); cx += colWidths.pct;
    drawCell(doc, cx, y, colWidths.gr,  rH, '',      { bg: BG_HDR });
    y += rH;

    // ── Conduct row ─────────────────────────────────────────────────────────────
    cx = ML;
    drawCell(doc, cx, y, colWidths.sub, rH, 'Conduct',              { size: 7, align: 'left' });  cx += colWidths.sub;
    drawCell(doc, cx, y, colWidths.max, rH, '40',                   { size: 7, align: 'center' }); cx += colWidths.max;
    drawCell(doc, cx, y, colWidths.cat, rH, '',                     { }); cx += colWidths.cat;
    drawCell(doc, cx, y, colWidths.exam,rH, '',                     { }); cx += colWidths.exam;
    drawCell(doc, cx, y, colWidths.tot, rH, '',                     { }); cx += colWidths.tot;
    drawCell(doc, cx, y, colWidths.pct, rH, '',                     { }); cx += colWidths.pct;
    drawCell(doc, cx, y, colWidths.gr,  rH, report.conduct_grade || '', { bold: true, size: 7.5, align: 'center' });
    y += rH;

    // ── "All Subjects" divider ─────────────────────────────────────────────────
    drawCell(doc, ML, y, CW, rH - 2, 'All Subjects', { bold: true, size: 7, bg: '#CBCBCB', align: 'left', color: '#111' });
    y += rH - 2;

    // ── Subject rows ───────────────────────────────────────────────────────────
    rows.forEach((row, idx) => {
      const bg = idx % 2 === 1 ? BG_ALT : null;
      cx = ML;
      drawCell(doc, cx, y, colWidths.sub, rH, row.name,   { size: 7,   align: 'left',   bg }); cx += colWidths.sub;
      drawCell(doc, cx, y, colWidths.max, rH, row.maxTotal,{ size: 7,   align: 'center', bg }); cx += colWidths.max;
      drawCell(doc, cx, y, colWidths.cat, rH, row.cat,    { size: 7,   align: 'center', bg }); cx += colWidths.cat;
      drawCell(doc, cx, y, colWidths.exam,rH, row.exam,   { size: 7,   align: 'center', bg }); cx += colWidths.exam;
      drawCell(doc, cx, y, colWidths.tot, rH, row.total,  { size: 7,   bold: true, align: 'center', bg }); cx += colWidths.tot;
      drawCell(doc, cx, y, colWidths.pct, rH, `${row.pct}%`, { size: 7, bold: true, align: 'center', bg }); cx += colWidths.pct;
      drawCell(doc, cx, y, colWidths.gr,  rH, row.grade,  { size: 8,   bold: true, align: 'center', bg });
      y += rH;
    });

    // ── Totals row ─────────────────────────────────────────────────────────────
    cx = ML;
    drawCell(doc, cx, y, colWidths.sub, rH, 'Total', { bold: true, size: 7, bg: BG_TOT, align: 'left' });  cx += colWidths.sub;
    drawCell(doc, cx, y, colWidths.max, rH, totalMaxAll,  { bold: true, size: 7, bg: BG_TOT, align: 'center' }); cx += colWidths.max;
    drawCell(doc, cx, y, colWidths.cat, rH, totalCat,     { bold: true, size: 7, bg: BG_TOT, align: 'center' }); cx += colWidths.cat;
    drawCell(doc, cx, y, colWidths.exam,rH, totalExam,    { bold: true, size: 7, bg: BG_TOT, align: 'center' }); cx += colWidths.exam;
    drawCell(doc, cx, y, colWidths.tot, rH, totalAll,     { bold: true, size: 8, bg: BG_TOT, align: 'center' }); cx += colWidths.tot;
    drawCell(doc, cx, y, colWidths.pct, rH, `${overallPct}%`, { bold: true, size: 8, bg: BG_TOT, align: 'center' }); cx += colWidths.pct;
    drawCell(doc, cx, y, colWidths.gr,  rH, overallGrade, { bold: true, size: 8, bg: BG_TOT, align: 'center' });
    y += rH;

    // ── Percentage summary row ──────────────────────────────────────────────────
    const summaryLabelW = colWidths.sub + colWidths.max + colWidths.cat + colWidths.exam + colWidths.tot;
    const summaryValW   = colWidths.pct + colWidths.gr;
    cx = ML;
    drawCell(doc, cx, y, summaryLabelW, rH, 'Percentage', { bold: true, size: 7, bg: BG_ALT, align: 'left' }); cx += summaryLabelW;
    drawCell(doc, cx, y, summaryValW,   rH, `${overallPct} %`,
      { bold: true, size: 8.5, bg: BG_ALT, align: 'center',
        color: overallPct >= 50 ? '#145214' : '#8b0000' });
    y += rH;

    // ── Final Grade row ─────────────────────────────────────────────────────────
    cx = ML;
    drawCell(doc, cx, y, summaryLabelW, rH, 'Final Grade', { bold: true, size: 7, align: 'left' }); cx += summaryLabelW;
    drawCell(doc, cx, y, summaryValW,   rH, overallGrade,  { bold: true, size: 10, align: 'center' });
    y += rH;

    // ── Position row ────────────────────────────────────────────────────────────
    const posStr = report.position_in_class ? `${report.position_in_class} out of class` : '—';
    cx = ML;
    drawCell(doc, cx, y, summaryLabelW, rH, 'Position', { bold: true, size: 7, bg: BG_ALT, align: 'left' }); cx += summaryLabelW;
    drawCell(doc, cx, y, summaryValW,   rH, posStr,     { bold: true, size: 7.5, bg: BG_ALT, align: 'center' });
    y += rH;

    // ── Decision row ────────────────────────────────────────────────────────────
    if (decision) {
      const dLabel = decision === 'PROMOTED' ? 'PROMOTED'
                   : decision === 'SECOND_SITTING' ? 'SECOND SITTING'
                   : 'REPEAT YEAR';
      const dColor = decision === 'PROMOTED' ? '#145214'
                   : decision === 'SECOND_SITTING' ? '#7a4800'
                   : '#8b0000';
      cx = ML;
      drawCell(doc, cx, y, summaryLabelW, rH, 'Decision', { bold: true, size: 7, align: 'left' }); cx += summaryLabelW;
      drawCell(doc, cx, y, summaryValW,   rH, dLabel,     { bold: true, size: 8, align: 'center', color: dColor });
      y += rH;
    }

    y += 3;

    // ── 4. COMMENT ────────────────────────────────────────────────────────────
    const commentH = 38;
    const commentLabelW = 60;
    const commentText = [
      report.teacher_remarks ? `Teacher: ${report.teacher_remarks}` : '',
      report.principal_remarks ? `Principal: ${report.principal_remarks}` : '',
    ].filter(Boolean).join('  |  ') || '';
    drawCell(doc, ML, y, commentLabelW, commentH, 'Comment', { bold: true, size: 7, bg: BG_ALT, align: 'left', vAlign: 'top' });
    drawCell(doc, ML + commentLabelW, y, CW - commentLabelW, commentH, commentText, { size: 7, align: 'left', vAlign: 'top' });
    y += commentH;

    // ── 5. SIGNATURES ─────────────────────────────────────────────────────────
    const sigH = 35;
    const sigW = CW / 2;
    drawCell(doc, ML,        y, sigW, sigH, "Class Teacher's Signature", { bold: true, size: 7, vAlign: 'top' });
    drawCell(doc, ML + sigW, y, sigW, sigH, "Parent's Signature",        { bold: true, size: 7, vAlign: 'top' });
    y += sigH + 5;

    // ── 6. GRADING SCALE ──────────────────────────────────────────────────────
    const scaleRows = [
      { label: 'Final Grade',  values: ['100-80', '79-75', '74-70', '69-65', '64-50', '49-40', '39-00'] },
      { label: 'Letter Grade', values: ['A', 'B', 'C', 'D', 'E', 'S', 'F'] },
      { label: 'Grade Value',  values: ['6', '5', '4', '3', '2', '1', '0'] },
    ];
    const scH = 13;
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

module.exports = { generateReportCard };
