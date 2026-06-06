require('dotenv').config();
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Seeding KNOTTY database...');

  // ─── School ───
  const school = await prisma.school.upsert({
    where: { email: 'admin@knottyschool.rw' },
    update: {},
    create: {
      name: 'KNOTTY Model School',
      email: 'admin@knottyschool.rw',
      code: 'KMS',
      address: 'KG 12 Ave, Kigali, Rwanda',
      phone: '+250788000001',
      subscription_plan: 'PREMIUM',
    },
  });
  console.log('School created:', school.name, '| id:', school.id);

  // ─── Admin user ───
  const adminHash = await bcrypt.hash('Admin@2024', 10);
  await prisma.user.upsert({
    where: { email: 'admin@knottyschool.rw' },
    update: { password_hash: adminHash, is_active: true },
    create: {
      school_id: school.id,
      role: 'ADMIN',
      first_name: 'School',
      last_name: 'Admin',
      email: 'admin@knottyschool.rw',
      phone: '+250788000001',
      password_hash: adminHash,
    },
  });

  // ─── Staff users ───
  const staffPassword = await bcrypt.hash('Staff@2024', 10);
  const staffUsers = [
    { role: 'TEACHER',    first: 'Kagabo',   last: 'Robert',  email: 'teacher@knottyschool.rw',    phone: '+250788100001' },
    { role: 'NURSE',      first: 'Mutoni',   last: 'Diane',   email: 'nurse@knottyschool.rw',      phone: '+250788100002' },
    { role: 'BURSAR',     first: 'Nshimiye', last: 'Paul',    email: 'bursar@knottyschool.rw',     phone: '+250788100003' },
    { role: 'DISCIPLINE', first: 'Rugamba',  last: 'Victor',  email: 'discipline@knottyschool.rw', phone: '+250788100004' },
    { role: 'CANTEEN',    first: 'Umutoni',  last: 'Claire',  email: 'canteen@knottyschool.rw',    phone: '+250788100005' },
  ];
  for (const s of staffUsers) {
    await prisma.user.upsert({
      where: { email: s.email },
      update: { password_hash: staffPassword, is_active: true },
      create: {
        school_id: school.id,
        role: s.role,
        first_name: s.first,
        last_name: s.last,
        email: s.email,
        phone: s.phone,
        password_hash: staffPassword,
      },
    });
  }
  console.log('Staff users seeded');

  // ─── Levels ───
  const s5 = await prisma.level.upsert({
    where: { id: 'level-s5-seed' },
    update: {},
    create: { id: 'level-s5-seed', school_id: school.id, name: 'Senior 5', order_index: 5 },
  });
  const s6 = await prisma.level.upsert({
    where: { id: 'level-s6-seed' },
    update: {},
    create: { id: 'level-s6-seed', school_id: school.id, name: 'Senior 6', order_index: 6 },
  });

  // ─── Classes ───
  const classA = await prisma.class.upsert({
    where: { id: 'class-s5a-seed' },
    update: {},
    create: { id: 'class-s5a-seed', school_id: school.id, level_id: s5.id, name: 'A', academic_year: '2025-2026' },
  });
  const classB = await prisma.class.upsert({
    where: { id: 'class-s5b-seed' },
    update: {},
    create: { id: 'class-s5b-seed', school_id: school.id, level_id: s5.id, name: 'B', academic_year: '2025-2026' },
  });
  const classC = await prisma.class.upsert({
    where: { id: 'class-s6a-seed' },
    update: {},
    create: { id: 'class-s6a-seed', school_id: school.id, level_id: s6.id, name: 'Science', academic_year: '2025-2026' },
  });

  // ─── Students ───
  const studentPassword = await bcrypt.hash('Student@2024', 10);
  const studentsData = [
    { first: 'Hirwa', last: 'Jean', email: 'hirwa.jean@knotty.rw', class_id: classA.id, level_id: s5.id },
    { first: 'Uwase', last: 'Marie', email: 'uwase.marie@knotty.rw', class_id: classA.id, level_id: s5.id },
    { first: 'Nkurunziza', last: 'Eric', email: 'nkurunziza.eric@knotty.rw', class_id: classB.id, level_id: s5.id },
    { first: 'Mukamana', last: 'Alice', email: 'mukamana.alice@knotty.rw', class_id: classB.id, level_id: s5.id },
    { first: 'Habimana', last: 'Patrick', email: 'habimana.patrick@knotty.rw', class_id: classA.id, level_id: s5.id },
    { first: 'Uwimana', last: 'Grace', email: 'uwimana.grace@knotty.rw', class_id: classC.id, level_id: s6.id },
    { first: 'Mutabazi', last: 'David', email: 'mutabazi.david@knotty.rw', class_id: classC.id, level_id: s6.id },
    { first: 'Ingabire', last: 'Sandra', email: 'ingabire.sandra@knotty.rw', class_id: classA.id, level_id: s5.id },
    { first: 'Ishimwe', last: 'Christian', email: 'ishimwe.christian@knotty.rw', class_id: classB.id, level_id: s5.id },
    { first: 'Kayitesi', last: 'Florentine', email: 'kayitesi.florentine@knotty.rw', class_id: classC.id, level_id: s6.id },
  ];

  let seq = 1;
  for (const s of studentsData) {
    const existing = await prisma.user.findUnique({ where: { email: s.email } });
    if (existing) { seq++; continue; }

    const user = await prisma.user.create({
      data: {
        school_id: school.id,
        role: 'STUDENT',
        first_name: s.first,
        last_name: s.last,
        email: s.email,
        phone: `+25078800${String(seq).padStart(4, '0')}`,
        password_hash: studentPassword,
      },
    });

    const studentCode = `KMS26${String(seq).padStart(4, '0')}`;
    const student = await prisma.student.create({
      data: {
        user_id: user.id,
        school_id: school.id,
        student_code: studentCode,
        class_id: s.class_id,
        level_id: s.level_id,
        gender: seq % 2 === 0 ? 'F' : 'M',
        nationality: 'Rwandan',
      },
    });

    const expires = new Date();
    expires.setFullYear(expires.getFullYear() + 2);
    await prisma.knottyCard.create({
      data: {
        student_id: student.id,
        school_id: school.id,
        card_number: `KNT-KMS-2026-${String(seq).padStart(5, '0')}`,
        qr_code: `https://placeholder.knotty.rw/qr/${studentCode}`,
        wallet_balance: 5000 + seq * 1000,
        expires_at: expires,
      },
    });

    seq++;
  }

  console.log(`Seeded ${seq - 1} students with cards`);
  console.log('\n=== LOGIN CREDENTIALS ===');
  console.log('ADMIN      admin@knottyschool.rw      Admin@2024');
  console.log('TEACHER    teacher@knottyschool.rw    Staff@2024');
  console.log('NURSE      nurse@knottyschool.rw      Staff@2024');
  console.log('BURSAR     bursar@knottyschool.rw     Staff@2024');
  console.log('DISCIPLINE discipline@knottyschool.rw Staff@2024');
  console.log('CANTEEN    canteen@knottyschool.rw    Staff@2024');
  console.log('STUDENT    hirwa.jean@knotty.rw       Student@2024');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
