// Seeds 10 students per class with parent accounts and KnottyCards
const prisma = require('../src/config/database');
const bcrypt = require('bcryptjs');

const SCHOOL_ID = '5dbebafe-be5b-466f-bdb2-54035eb7eb75';
const SCHOOL_CODE = 'KMS';
const DEFAULT_PASSWORD = 'Knotty@2024';

// Real Rwandan names pool
const FIRST_NAMES_M = ['Jean', 'Eric', 'Christian', 'Patrick', 'Emmanuel', 'Celestin', 'Olivier', 'Alain', 'Gilbert', 'Thierry', 'Kevin', 'Fabrice', 'Didier', 'Bruno', 'Felix'];
const FIRST_NAMES_F = ['Alice', 'Marie', 'Christine', 'Diane', 'Ange', 'Claire', 'Grace', 'Solange', 'Yvette', 'Chantal', 'Espérance', 'Immaculée', 'Joie', 'Liliane', 'Nadège'];
const LAST_NAMES = ['Mukamana', 'Nkurunziza', 'Ishimwe', 'Uwimana', 'Habimana', 'Mugisha', 'Niyonzima', 'Karangwa', 'Ndayishimiye', 'Bizimungu', 'Hategekimana', 'Nsengiyumva', 'Uwizera', 'Nshimiyimana', 'Ntawukuliryayo', 'Gasana', 'Rutagengwa', 'Kabera', 'Nyiraneza', 'Mukamurenzi'];
const PARENT_FIRST_NAMES = ['Jean-Baptiste', 'Innocent', 'Théodore', 'Augustin', 'Félicien', 'Celestin', 'Modeste', 'Anastase', 'Donatien', 'Cyprien', 'Jacqueline', 'Véronique', 'Agnès', 'Cécile', 'Marguerite'];

// Target real classes only (skip test/demo ones)
const TARGET_CLASSES = [
  { id: 'class-s5a-seed',                               levelId: 'level-s5-seed',                              name: 'Senior 5 A' },
  { id: 'class-s5b-seed',                               levelId: 'level-s5-seed',                              name: 'Senior 5 B' },
  { id: 'class-s6a-seed',                               levelId: 'level-s6-seed',                              name: 'Senior 6 Science' },
  { id: 'b27f5a89-392d-44ea-85d8-7161953a75a2',         levelId: 'e050a4ae-22d0-4259-86be-0f08156272a0',       name: 'Senior 1 A' },
  { id: '8c0e11fb-2d6c-4d1e-b546-1d43cebe3170',         levelId: 'e050a4ae-22d0-4259-86be-0f08156272a0',       name: 'Senior 1 B' },
];

let studentCodeCounter = 0;
async function getNextCode() {
  // Find the highest existing code
  if (studentCodeCounter === 0) {
    const last = await prisma.student.findFirst({
      where: { school_id: SCHOOL_ID },
      orderBy: { student_code: 'desc' },
      select: { student_code: true }
    });
    const lastNum = last ? parseInt(last.student_code.replace(SCHOOL_CODE, ''), 10) : 0;
    studentCodeCounter = lastNum;
  }
  studentCodeCounter++;
  return `${SCHOOL_CODE}${String(studentCodeCounter).padStart(6, '0')}`;
}

function pick(arr, seed) {
  return arr[seed % arr.length];
}

async function generateCardNumber(schoolId) {
  let cardNumber;
  let exists = true;
  while (exists) {
    cardNumber = 'KMC' + Math.floor(1000000000 + Math.random() * 9000000000);
    const ex = await prisma.knottyCard.findUnique({ where: { card_number: cardNumber } });
    exists = !!ex;
  }
  return cardNumber;
}

async function createStudent(cls, index) {
  const gender = index % 2 === 0 ? 'M' : 'F';
  const firstNames = gender === 'M' ? FIRST_NAMES_M : FIRST_NAMES_F;
  const firstName = pick(firstNames, index + cls.id.charCodeAt(0));
  const lastName = pick(LAST_NAMES, index * 3 + cls.id.charCodeAt(2));
  const studentCode = await getNextCode();
  const email = `${firstName.toLowerCase().replace(/[^a-z]/g, '')}.${lastName.toLowerCase()}${studentCode.toLowerCase()}@student.knotty.rw`;
  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);

  const parentFirstName = pick(PARENT_FIRST_NAMES, index + cls.id.charCodeAt(1));
  const parentPhone = `+25078${String(1000000 + index * 7 + cls.id.charCodeAt(0) * 13).slice(0, 7)}`;
  const parentEmail = `parent.${lastName.toLowerCase()}${studentCode.toLowerCase()}@parent.knotty.rw`;
  const parentPasswordHash = await bcrypt.hash('Parent@2024', 10);

  const dob = new Date(2006 + (index % 5), index % 12, (index % 28) + 1);

  return prisma.$transaction(async (tx) => {
    // Create parent user
    const parentUser = await tx.user.create({
      data: {
        school_id: SCHOOL_ID,
        role: 'PARENT',
        first_name: parentFirstName,
        last_name: lastName,
        email: parentEmail,
        phone: parentPhone,
        password_hash: parentPasswordHash,
        is_active: true,
      }
    });

    // Create student user
    const studentUser = await tx.user.create({
      data: {
        school_id: SCHOOL_ID,
        role: 'STUDENT',
        first_name: firstName,
        last_name: lastName,
        email,
        phone: `+25079${String(2000000 + index * 11 + cls.id.charCodeAt(0) * 7).slice(0, 7)}`,
        password_hash: passwordHash,
        is_active: true,
      }
    });

    // Create student record
    const student = await tx.student.create({
      data: {
        user_id: studentUser.id,
        school_id: SCHOOL_ID,
        student_code: studentCode,
        class_id: cls.id,
        level_id: cls.levelId,
        gender,
        date_of_birth: dob,
        nationality: 'Rwandan',
        parent_id: parentUser.id,
      }
    });

    // Issue KnottyCard
    const cardNumber = await generateCardNumber(SCHOOL_ID);
    const qrCode = `QR-${SCHOOL_CODE}-${studentCode}-${Date.now()}`;
    const card = await tx.knottyCard.create({
      data: {
        student_id: student.id,
        school_id: SCHOOL_ID,
        card_number: cardNumber,
        qr_code: qrCode,
        wallet_balance: Math.floor(Math.random() * 5000) + 1000, // 1000-6000 RWF
        is_active: true,
        is_frozen: false,
        expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000 * 2), // 2 years
      }
    });

    return {
      student,
      studentEmail: email,
      studentPassword: DEFAULT_PASSWORD,
      studentName: `${firstName} ${lastName}`,
      studentCode,
      parentName: `${parentFirstName} ${lastName}`,
      parentEmail,
      parentPhone,
      cardNumber: card.card_number,
      walletBalance: card.wallet_balance,
      className: cls.name,
    };
  });
}

async function main() {
  console.log('Starting student seeding...\n');
  const credentials = [];

  for (const cls of TARGET_CLASSES) {
    // Count existing students in this class
    const existing = await prisma.student.count({
      where: { class_id: cls.id, is_active: true }
    });
    const toCreate = Math.max(0, 10 - existing);
    console.log(`${cls.name}: ${existing} existing → creating ${toCreate} more`);

    for (let i = 0; i < toCreate; i++) {
      try {
        const result = await createStudent(cls, existing + i);
        credentials.push(result);
        process.stdout.write(`  ✓ ${result.studentName} (${result.studentCode})\n`);
      } catch (err) {
        console.error(`  ✗ Error creating student ${i + 1} for ${cls.name}:`, err.message);
      }
    }
    console.log('');
  }

  // Print credentials table
  console.log('\n' + '='.repeat(120));
  console.log('STUDENT CREDENTIALS & CARD REPORT');
  console.log('='.repeat(120));
  console.log(
    'Class'.padEnd(16) +
    'Name'.padEnd(24) +
    'Code'.padEnd(12) +
    'Email'.padEnd(42) +
    'Password'.padEnd(14) +
    'Card Number'.padEnd(18) +
    'Wallet (RWF)'
  );
  console.log('-'.repeat(120));

  credentials.forEach(c => {
    console.log(
      c.className.padEnd(16) +
      c.studentName.padEnd(24) +
      c.studentCode.padEnd(12) +
      c.studentEmail.padEnd(42) +
      c.studentPassword.padEnd(14) +
      c.cardNumber.padEnd(18) +
      c.walletBalance.toLocaleString()
    );
  });

  console.log('\n' + '='.repeat(120));
  console.log('PARENT CREDENTIALS');
  console.log('='.repeat(120));
  console.log(
    'Student'.padEnd(24) +
    'Parent Name'.padEnd(24) +
    'Parent Email'.padEnd(42) +
    'Parent Phone'.padEnd(18) +
    'Password'
  );
  console.log('-'.repeat(120));

  credentials.forEach(c => {
    console.log(
      c.studentName.padEnd(24) +
      c.parentName.padEnd(24) +
      c.parentEmail.padEnd(42) +
      c.parentPhone.padEnd(18) +
      'Parent@2024'
    );
  });

  console.log('\n' + '='.repeat(120));
  console.log(`Total students created: ${credentials.length}`);
  console.log('All cards are ACTIVE and ready for tap-in/tap-out\n');
}

main().catch(console.error).finally(() => process.exit());
