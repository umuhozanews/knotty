require('dotenv').config();
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const SCHOOLS_DATA = [
  {
    code: 'KMS',
    name: 'IshuriHUB Model School',
    email: 'admin@ishurihub.rw',
    phone: '+250788000001',
    address: 'KG 12 Ave, Kigali, Rwanda',
    subscription_plan: 'PREMIUM',
  },
  {
    code: 'GHIA',
    name: 'Green Hills International Academy',
    email: 'admin@greenhills.ishurihub.rw',
    phone: '+250788200001',
    address: 'Nyarutarama Road, Gasabo, Kigali',
    subscription_plan: 'PREMIUM',
  },
  {
    code: 'RHS',
    name: 'Riviera High School',
    email: 'admin@riviera.ishurihub.rw',
    phone: '+250788300001',
    address: 'Kabuga Hill, Gasabo, Kigali',
    subscription_plan: 'PREMIUM',
  },
  {
    code: 'KSS',
    name: 'Kagarama Secondary School',
    email: 'admin@kagarama.ishurihub.rw',
    phone: '+250788400001',
    address: 'KK 15 Ave, Kicukiro, Kigali',
    subscription_plan: 'BASIC',
  },
  {
    code: 'LDK',
    name: 'Lycée de Kigali',
    email: 'admin@ldk.ishurihub.rw',
    phone: '+250788500001',
    address: 'KN 3 Rd, Kiyovu, Nyarugenge',
    subscription_plan: 'PREMIUM',
  },
  {
    code: 'GSSF',
    name: 'GS Sainte Famille',
    email: 'admin@saintefamille.ishurihub.rw',
    phone: '+250788600001',
    address: 'Downtown Kigali, Nyarugenge',
    subscription_plan: 'BASIC',
  },
  {
    code: 'SOST',
    name: 'SOS Hermann Gmeiner Technical School',
    email: 'admin@sos.ishurihub.rw',
    phone: '+250788700001',
    address: 'KG 563 St, Kacyiru, Kigali',
    subscription_plan: 'PREMIUM',
  },
];

const STAFF_ROLES_CONFIG = [
  { role: 'TEACHER',    dept: 'Sciences & Tech',      first: 'Robert',  last: 'Kagabo',   title: 'Senior Math & Physics Teacher' },
  { role: 'TEACHER',    dept: 'Languages',            first: 'Aline',   last: 'Mutoni',   title: 'English & Kinyarwanda Teacher' },
  { role: 'CANTEEN',    dept: 'Canteen & Catering',   first: 'Claire',  last: 'Umutoni',  title: 'Head Cantinier / POS Officer' },
  { role: 'BURSAR',     dept: 'Finance & Accounts',   first: 'Paul',    last: 'Nshimiye', title: 'School Bursar & Accountant' },
  { role: 'NURSE',      dept: 'Health & Infirmary',   first: 'Diane',   last: 'Mukamana', title: 'Resident Medical Nurse' },
  { role: 'DISCIPLINE', dept: 'Discipline & Welfare', first: 'Victor',  last: 'Rugamba',  title: 'Chief Discipline Master' },
  { role: 'LIBRARIAN',  dept: 'Library & Media',      first: 'Jeanne',  last: 'Uwase',    title: 'Head Librarian' },
];

const CANTEEN_PRESETS = [
  { name: 'Bottled Water 500ml', price: 300, category: 'Drinks', photo_url: '/canteen/water.png' },
  { name: 'Samosa (Beef)', price: 300, category: 'Snacks', photo_url: '/canteen/sambusa.png' },
  { name: 'Chapati', price: 300, category: 'Bread', photo_url: '/canteen/chapati.png' },
  { name: 'Amandazi (Fresh)', price: 200, category: 'Snacks', photo_url: '/canteen/amandazi.png' },
  { name: 'Inyange Juice 300ml', price: 600, category: 'Drinks', photo_url: '/canteen/inyange.png' },
  { name: 'Hot Lunch Plate', price: 1800, category: 'Meals', photo_url: '/canteen/rice_meat.png' },
];

async function main() {
  console.log('Seeding 7 Rwandan schools with isolated operations, workers, and students...');

  const adminHash = await bcrypt.hash('Admin@2024', 10);
  const staffHash = await bcrypt.hash('Staff@2024', 10);
  const studentHash = await bcrypt.hash('Student@2024', 10);

  for (let i = 0; i < SCHOOLS_DATA.length; i++) {
    const sData = SCHOOLS_DATA[i];
    console.log(`\n[${i + 1}/7] Processing ${sData.name} (${sData.code})...`);

    // 1. Upsert School
    let school = await prisma.school.findFirst({
      where: { OR: [{ code: sData.code }, { email: sData.email }] },
    });

    if (school) {
      school = await prisma.school.update({
        where: { id: school.id },
        data: {
          name: sData.name,
          code: sData.code,
          phone: sData.phone,
          address: sData.address,
          subscription_plan: sData.subscription_plan,
        },
      });
    } else {
      school = await prisma.school.create({
        data: {
          name: sData.name,
          code: sData.code,
          email: sData.email,
          phone: sData.phone,
          address: sData.address,
          subscription_plan: sData.subscription_plan,
        },
      });
    }
    console.log(`  ✓ School ready: ${school.id}`);

    // 2. Ensure School Admin
    const adminEmail = sData.email;
    let adminUser = await prisma.user.findUnique({ where: { email: adminEmail } });
    if (!adminUser) {
      adminUser = await prisma.user.create({
        data: {
          school_id: school.id,
          role: 'ADMIN',
          first_name: 'Director',
          last_name: sData.code,
          email: adminEmail,
          phone: sData.phone,
          password_hash: adminHash,
          is_active: true,
        },
      });
    }

    // 3. Ensure Levels & Classes for this school
    const levels = ['Senior 1', 'Senior 2', 'Senior 3', 'Senior 4', 'Senior 5', 'Senior 6'];
    const createdClasses = [];
    for (let lIdx = 0; lIdx < levels.length; lIdx++) {
      const levelName = levels[lIdx];
      let level = await prisma.level.findFirst({
        where: { school_id: school.id, name: levelName },
      });
      if (!level) {
        level = await prisma.level.create({
          data: {
            school_id: school.id,
            name: levelName,
            order_index: lIdx + 1,
          },
        });
      }

      // Add Class A and B
      for (const section of ['A', 'B']) {
        let cls = await prisma.class.findFirst({
          where: { school_id: school.id, level_id: level.id, name: section },
        });
        if (!cls) {
          cls = await prisma.class.create({
            data: {
              school_id: school.id,
              level_id: level.id,
              name: section,
              academic_year: '2025-2026',
            },
          });
        }
        createdClasses.push(cls);
      }
    }
    console.log(`  ✓ Levels & classes ready (${createdClasses.length} classes)`);

    // 4. Ensure Workers (Teachers, Cantiniers, Bursars, Nurses, Discipline, Librarians)
    for (let wIdx = 0; wIdx < STAFF_ROLES_CONFIG.length; wIdx++) {
      const cfg = STAFF_ROLES_CONFIG[wIdx];
      const staffEmail = `${cfg.role.toLowerCase()}.${sData.code.toLowerCase()}@ishurihub.rw`;

      let staffUser = await prisma.user.findUnique({ where: { email: staffEmail } });
      if (!staffUser) {
        staffUser = await prisma.user.create({
          data: {
            school_id: school.id,
            role: cfg.role,
            first_name: cfg.first,
            last_name: `${cfg.last} (${sData.code})`,
            email: staffEmail,
            phone: `+250788${String(i + 1).padStart(2, '0')}${String(wIdx + 1).padStart(4, '0')}`,
            password_hash: staffHash,
            is_active: true,
          },
        });
      }

      // If teacher, ensure Teacher record
      if (cfg.role === 'TEACHER') {
        const empCode = `TCH-${sData.code}-${String(wIdx + 1).padStart(3, '0')}`;
        const teacherRec = await prisma.teacher.findFirst({
          where: { user_id: staffUser.id },
        });
        if (!teacherRec) {
          await prisma.teacher.create({
            data: {
              user_id: staffUser.id,
              school_id: school.id,
              employee_code: empCode,
              qualification: "Bachelor's in Education",
              specialization: cfg.dept,
              subjects_taught: [
                { subject: cfg.dept, class_name: `${sData.code}-S5A` },
              ],
            },
          });
        }
      }
    }
    console.log(`  ✓ Workers & staff ready (7 key roles initialized)`);

    // 5. Ensure Students and NFC Cards (at least 6 active students per school)
    const firstNames = ['Cedric', 'Ange', 'Gael', 'Fiona', 'Pacifique', 'Sandrine'];
    const lastNames = ['Mugisha', 'Ingabire', 'Manzi', 'Tuyishime', 'Nshimiyimana', 'Uwase'];

    for (let sIdx = 0; sIdx < 6; sIdx++) {
      const studentCode = `${sData.code}26${String(sIdx + 1).padStart(4, '0')}`;
      const studentEmail = `${firstNames[sIdx].toLowerCase()}.${studentCode.toLowerCase()}@student.ishurihub.rw`;

      let studentUser = await prisma.user.findUnique({ where: { email: studentEmail } });
      if (!studentUser) {
        studentUser = await prisma.user.create({
          data: {
            school_id: school.id,
            role: 'STUDENT',
            first_name: firstNames[sIdx],
            last_name: lastNames[sIdx],
            email: studentEmail,
            phone: `+250789${String(i + 1).padStart(2, '0')}${String(sIdx + 1).padStart(4, '0')}`,
            password_hash: studentHash,
            is_active: true,
          },
        });
      }

      let student = await prisma.student.findUnique({ where: { student_code: studentCode } });
      if (!student) {
        const targetClass = createdClasses[sIdx % createdClasses.length];
        student = await prisma.student.create({
          data: {
            user_id: studentUser.id,
            school_id: school.id,
            student_code: studentCode,
            class_id: targetClass?.id,
            level_id: targetClass?.level_id,
            gender: sIdx % 2 === 0 ? 'M' : 'F',
            nationality: 'Rwandan',
          },
        });
      }

      // NFC Smart Card
      let card = await prisma.knottyCard.findUnique({ where: { student_id: student.id } });
      if (!card) {
        const expires = new Date();
        expires.setFullYear(expires.getFullYear() + 2);
        await prisma.knottyCard.create({
          data: {
            student_id: student.id,
            school_id: school.id,
            card_number: `KNT-${sData.code}-2026-${String(sIdx + 1).padStart(4, '0')}`,
            qr_code: `https://ishuri-hub.pages.dev/qr/${studentCode}`,
            wallet_balance: 10000 + (sIdx * 2500),
            expires_at: expires,
          },
        });
      }
    }
    console.log(`  ✓ Students and Smart Cards initialized`);

    // 6. Canteen Products
    for (const cp of CANTEEN_PRESETS) {
      const existing = await prisma.canteenProduct.findFirst({
        where: { school_id: school.id, name: cp.name },
      });
      if (!existing) {
        await prisma.canteenProduct.create({
          data: {
            school_id: school.id,
            name: cp.name,
            price: cp.price,
            category: cp.category,
            photo_url: cp.photo_url,
            stock_qty: 150,
          },
        });
      }
    }
    console.log(`  ✓ Canteen menu with real food photos created`);
  }

  console.log('\n==============================================');
  console.log('✓ All 7 schools seeded with isolated operations!');
  console.log('==============================================');
}

main()
  .catch((e) => {
    console.error('Multi-school seed error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
