require('dotenv').config();
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Seeding KNOTTY database with rich mock data...');

  // 1. School
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

  // 2. Admin User
  const adminHash = await bcrypt.hash('Admin@2024', 10);
  const admin = await prisma.user.upsert({
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

  // 3. Staff Users
  const staffPassword = await bcrypt.hash('Staff@2024', 10);
  const staffData = [
    { role: 'TEACHER',    first: 'Kagabo',   last: 'Robert',  email: 'teacher@knottyschool.rw',    phone: '+250788100001' },
    { role: 'NURSE',      first: 'Mutoni',   last: 'Diane',   email: 'nurse@knottyschool.rw',      phone: '+250788100002' },
    { role: 'BURSAR',     first: 'Nshimiye', last: 'Paul',    email: 'bursar@knottyschool.rw',     phone: '+250788100003' },
    { role: 'DISCIPLINE', first: 'Rugamba',  last: 'Victor',  email: 'discipline@knottyschool.rw', phone: '+250788100004' },
    { role: 'CANTEEN',    first: 'Umutoni',  last: 'Claire',  email: 'canteen@knottyschool.rw',    phone: '+250788100005' },
  ];
  
  const staff = {};
  for (const s of staffData) {
    const u = await prisma.user.upsert({
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
    staff[s.role] = u;
  }
  console.log('Staff users seeded');

  // 4. Levels
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

  // 5. Classes
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

  // 6. Students
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

  const students = [];
  let seq = 1;
  for (const s of studentsData) {
    let user = await prisma.user.findUnique({ where: { email: s.email } });
    if (!user) {
      user = await prisma.user.create({
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
    }

    const studentCode = `KMS26${String(seq).padStart(4, '0')}`;
    let student = await prisma.student.findUnique({ where: { student_code: studentCode } });
    if (!student) {
      student = await prisma.student.create({
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
    }

    let card = await prisma.knottyCard.findUnique({ where: { student_id: student.id } });
    if (!card) {
      const expires = new Date();
      expires.setFullYear(expires.getFullYear() + 2);
      card = await prisma.knottyCard.create({
        data: {
          student_id: student.id,
          school_id: school.id,
          card_number: `KNT-KMS-2026-${String(seq).padStart(5, '0')}`,
          qr_code: `https://placeholder.knotty.rw/qr/${studentCode}`,
          wallet_balance: 15000,
          expires_at: expires,
        },
      });
    }

    students.push({ student, card, user });
    seq++;
  }
  console.log(`Seeded ${students.length} students with cards`);

  // Clear existing transactions/attendance for a clean seed
  await prisma.attendance.deleteMany({ where: { school_id: school.id } });
  await prisma.walletTransaction.deleteMany({ where: { school_id: school.id } });
  await prisma.canteenTransaction.deleteMany({ where: { school_id: school.id } });
  await prisma.healthRecord.deleteMany({ where: { school_id: school.id } });
  await prisma.disciplineRecord.deleteMany({ where: { school_id: school.id } });
  await prisma.achievement.deleteMany({ where: { school_id: school.id } });
  await prisma.academicReport.deleteMany({ where: { school_id: school.id } });
  await prisma.feePayment.deleteMany({ where: { school_id: school.id } });

  // 7. Seeding Attendance (Last 15 days)
  console.log('Seeding attendance history...');
  const days = 15;
  const recordedBy = staff.TEACHER.id;
  for (let i = days; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    // skip weekends unless it is today
    if (i > 0 && (date.getDay() === 0 || date.getDay() === 6)) continue;
    date.setHours(0, 0, 0, 0);

    for (const { student } of students) {
      const rand = Math.random();
      let status = 'PRESENT';
      let checkIn = null;
      let checkOut = null;

      if (rand < 0.82) {
        status = 'PRESENT';
        checkIn = new Date(date);
        checkIn.setHours(7, Math.floor(Math.random() * 59), 0, 0);
        checkOut = new Date(date);
        checkOut.setHours(16, Math.floor(Math.random() * 59), 0, 0);
      } else if (rand < 0.92) {
        status = 'LATE';
        checkIn = new Date(date);
        checkIn.setHours(8, 30 + Math.floor(Math.random() * 30), 0, 0);
        checkOut = new Date(date);
        checkOut.setHours(16, Math.floor(Math.random() * 59), 0, 0);
      } else if (rand < 0.97) {
        status = 'ABSENT';
      } else {
        status = 'EXCUSED';
      }

      await prisma.attendance.create({
        data: {
          student_id: student.id,
          class_id: student.class_id,
          school_id: school.id,
          date,
          check_in_time: checkIn,
          check_out_time: checkOut,
          status,
          recorded_by: recordedBy,
        },
      });
    }
  }

  // 8. Seeding Wallet & Canteen Transactions
  console.log('Seeding canteen transactions & wallet history...');
  const canteenItems = [
    { name: 'Lunch Plate', price: 1500 },
    { name: 'Samosa', price: 400 },
    { name: 'Fanta', price: 600 },
    { name: 'Fruit Salad', price: 800 },
    { name: 'Milk Carton', price: 500 },
  ];

  for (const { student, card } of students) {
    // Top up wallet
    await prisma.walletTransaction.create({
      data: {
        card_id: card.id,
        student_id: student.id,
        school_id: school.id,
        type: 'TOP_UP',
        amount: 20000,
        balance_before: 0,
        balance_after: 20000,
        source: 'CASH',
        description: 'Initial deposit by cashier',
      },
    });

    let currentBalance = 20000;
    // Simulate 4 canteen purchases over the last few days
    for (let j = 4; j >= 0; j--) {
      const date = new Date();
      date.setDate(date.getDate() - j);
      date.setHours(12, 15, 0, 0);

      const count = 1 + Math.floor(Math.random() * 2);
      const items = [];
      let total = 0;
      for (let c = 0; c < count; c++) {
        const item = canteenItems[Math.floor(Math.random() * canteenItems.length)];
        items.push({ name: item.name, price: item.price, quantity: 1 });
        total += item.price;
      }

      const balBefore = currentBalance;
      currentBalance -= total;

      await prisma.canteenTransaction.create({
        data: {
          student_id: student.id,
          school_id: school.id,
          card_id: card.id,
          items_purchased: items,
          total_amount: total,
          wallet_balance_before: balBefore,
          wallet_balance_after: currentBalance,
          served_by: staff.CANTEEN.id,
          transaction_time: date,
        },
      });

      await prisma.walletTransaction.create({
        data: {
          card_id: card.id,
          student_id: student.id,
          school_id: school.id,
          type: 'DEDUCTION',
          amount: total,
          balance_before: balBefore,
          balance_after: currentBalance,
          source: 'ADMIN',
          description: `Canteen Purchase: ${items.map(i => i.name).join(', ')}`,
          created_at: date,
        },
      });
    }

    // Update DB card balance
    await prisma.knottyCard.update({
      where: { id: card.id },
      data: { wallet_balance: currentBalance },
    });
  }

  // 9. Seeding Fee Payments
  console.log('Seeding fee payments...');
  for (const { student } of students) {
    // Term 1 Completed
    await prisma.feePayment.create({
      data: {
        student_id: student.id,
        school_id: school.id,
        amount: 80000,
        payment_type: 'TUITION',
        payment_method: 'BANK_TRANSFER',
        status: 'COMPLETED',
        term: 'TERM1',
        academic_year: '2025-2026',
        paid_at: new Date(Date.now() - 90 * 24 * 3600 * 1000),
      },
    });

    // Term 2 Pending
    await prisma.feePayment.create({
      data: {
        student_id: student.id,
        school_id: school.id,
        amount: 80000,
        payment_type: 'TUITION',
        payment_method: 'MOMO',
        status: 'PENDING',
        term: 'TERM2',
        academic_year: '2025-2026',
      },
    });
  }

  // 10. Seeding Academic Reports
  console.log('Seeding academic term reports...');
  const subjects = ['Mathematics', 'Physics', 'Chemistry', 'English', 'Biology'];
  for (const { student } of students) {
    const grades = {};
    let totalMarks = 0;
    let maxMarks = 0;

    for (const sub of subjects) {
      const maxCat = 20;
      const maxExam = 80;
      const cat = 12 + Math.floor(Math.random() * 8);
      const exam = 45 + Math.floor(Math.random() * 32);
      const total = cat + exam;
      const pct = Math.round((total / (maxCat + maxExam)) * 100);
      
      let grade = 'F';
      if (pct >= 80) grade = 'A';
      else if (pct >= 75) grade = 'B';
      else if (pct >= 70) grade = 'C';
      else if (pct >= 65) grade = 'D';
      else if (pct >= 50) grade = 'E';

      grades[sub] = {
        cat, exam, total,
        max_cat: maxCat, max_exam: maxExam, max_total: maxCat + maxExam,
        percentage: pct, grade, remarks: pct >= 80 ? 'Excellent' : pct >= 65 ? 'Good' : 'Needs Effort'
      };

      totalMarks += total;
      maxMarks += (maxCat + maxExam);
    }
    grades._meta = { decision: 'PROMOTED' };

    const average = Math.round((totalMarks / maxMarks) * 100);

    await prisma.academicReport.create({
      data: {
        student_id: student.id,
        class_id: student.class_id,
        school_id: school.id,
        term: 'TERM1',
        academic_year: '2025-2026',
        grades,
        total_marks: totalMarks,
        average,
        position_in_class: 1 + Math.floor(Math.random() * 10),
        teacher_remarks: 'Consistently performs well, highly motivated.',
        principal_remarks: 'Promoted to next level. Great achievements.',
        conduct_grade: 'A',
        is_published: true,
        published_at: new Date(Date.now() - 45 * 24 * 3600 * 1000),
      },
    });
  }

  // 11. Seeding Health & Discipline Records
  console.log('Seeding health, discipline and achievements...');
  for (const { student } of students) {
    if (Math.random() > 0.4) {
      await prisma.healthRecord.create({
        data: {
          student_id: student.id,
          school_id: school.id,
          recorded_by: staff.NURSE.id,
          type: 'ILLNESS',
          title: 'Mild fever & headache',
          description: 'Presented with body temperatures of 38.5C. Administered paracetamol.',
          treatment_given: 'Paracetamol (500mg), rested for 1 hour.',
          severity: 'LOW',
          follow_up_required: false,
        },
      });
    }

    if (Math.random() > 0.5) {
      await prisma.disciplineRecord.create({
        data: {
          student_id: student.id,
          school_id: school.id,
          recorded_by: staff.TEACHER.id,
          type: 'WARNING',
          title: 'Late to class',
          description: 'Arrived 20 minutes late to morning class without an excuse note.',
          action_taken: 'Verbal warning and parent notified.',
          severity: 'MINOR',
          parent_notified: true,
        },
      });
    }

    if (Math.random() > 0.5) {
      await prisma.achievement.create({
        data: {
          student_id: student.id,
          school_id: school.id,
          recorded_by: staff.TEACHER.id,
          type: 'ACADEMIC',
          title: 'Class Project Excellence Award',
          description: 'Received top marks for their physics model presentation.',
        },
      });
    }
  }

  // 12. Seeding Materials
  console.log('Seeding syllabus materials...');
  const mats = [
    { title: 'Senior 5 Math Syllabus', subject: 'Mathematics', name: 'S5_Math_Syllabus.pdf', level: s5.id, class: classA.id },
    { title: 'Senior 6 Physics Guide', subject: 'Physics', name: 'S6_Physics_Guide.pdf', level: s6.id, class: classC.id },
    { title: 'Chemistry Lab Safety Rules', subject: 'Chemistry', name: 'Chemistry_Safety.pdf', level: s5.id, class: classB.id },
  ];

  for (const m of mats) {
    await prisma.material.create({
      data: {
        school_id: school.id,
        uploaded_by: staff.TEACHER.id,
        class_id: m.class,
        level_id: m.level,
        title: m.title,
        subject: m.subject,
        file_url: 'https://res.cloudinary.com/demo/image/upload/sample.pdf',
        file_name: m.name,
      },
    });
  }

  console.log('\nSeed successful!');
  console.log('Use seeded login credentials to view dynamic tables, charts, calendar and records.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
