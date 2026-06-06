const prisma = require('../config/database');

async function generateCardNumber(schoolCode) {
  const year = new Date().getFullYear();
  const prefix = `KNT-${schoolCode.toUpperCase()}-${year}`;

  const lastCard = await prisma.knottyCard.findFirst({
    where: { card_number: { startsWith: prefix } },
    orderBy: { created_at: 'desc' },
  });

  let seq = 1;
  if (lastCard) {
    const parts = lastCard.card_number.split('-');
    seq = parseInt(parts[parts.length - 1]) + 1;
  }

  return `${prefix}-${String(seq).padStart(5, '0')}`;
}

async function generateStudentCode(schoolCode) {
  const year = new Date().getFullYear().toString().slice(-2);
  const prefix = `${schoolCode.toUpperCase()}${year}`;

  const lastStudent = await prisma.student.findFirst({
    where: { student_code: { startsWith: prefix } },
    orderBy: { created_at: 'desc' },
  });

  let seq = 1;
  if (lastStudent) {
    const num = parseInt(lastStudent.student_code.replace(prefix, ''));
    seq = num + 1;
  }

  return `${prefix}${String(seq).padStart(4, '0')}`;
}

module.exports = { generateCardNumber, generateStudentCode };
