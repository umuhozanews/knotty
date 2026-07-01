// Generates tap-in/tap-out capability report for all students
const prisma = require('../src/config/database');

const SCHOOL_ID = '5dbebafe-be5b-466f-bdb2-54035eb7eb75';

const TARGET_CLASS_IDS = [
  'class-s5a-seed',
  'class-s5b-seed',
  'class-s6a-seed',
  'b27f5a89-392d-44ea-85d8-7161953a75a2',
  '8c0e11fb-2d6c-4d1e-b546-1d43cebe3170',
];

async function main() {
  const students = await prisma.student.findMany({
    where: {
      school_id: SCHOOL_ID,
      class_id: { in: TARGET_CLASS_IDS },
      is_active: true,
    },
    include: {
      user: { select: { first_name: true, last_name: true, email: true } },
      card: true,
      class: { select: { name: true } },
    },
    orderBy: [{ class_id: 'asc' }, { student_code: 'asc' }],
  });

  const canTap = [];
  const cannotTap = [];

  students.forEach(s => {
    const card = s.card;
    const name = `${s.user.first_name} ${s.user.last_name}`;
    const className = s.class?.name || s.class_id;
    const now = new Date();
    let status = 'NO CARD';
    let canAccess = false;
    let reason = 'No KnottyCard issued';

    if (card) {
      const expired = card.expires_at && new Date(card.expires_at) < now;
      if (!card.is_active) {
        status = 'INACTIVE';
        reason = 'Card is inactive';
      } else if (card.is_frozen) {
        status = 'FROZEN';
        reason = 'Card is frozen';
      } else if (expired) {
        status = 'EXPIRED';
        reason = `Expired ${card.expires_at.toISOString().split('T')[0]}`;
      } else {
        status = 'ACTIVE';
        canAccess = true;
        reason = 'Card active — gate access granted';
      }
    }

    const record = { name, code: s.student_code, className, status, canAccess, reason, cardNumber: card?.card_number || '—', email: s.user.email };
    if (canAccess) canTap.push(record);
    else cannotTap.push(record);
  });

  const total = students.length;
  const w = 120;

  console.log('\n' + '='.repeat(w));
  console.log('KNOTTYCARD GATE ACCESS REPORT — TAP IN / TAP OUT CAPABILITY');
  console.log(`School: Knotty School (${SCHOOL_ID})`);
  console.log(`Report Date: ${new Date().toLocaleString()}`);
  console.log(`Total Students: ${total}  |  CAN Tap: ${canTap.length}  |  CANNOT Tap: ${cannotTap.length}`);
  console.log('='.repeat(w));

  console.log('\n✅  STUDENTS WHO CAN TAP IN / OUT  (' + canTap.length + ')');
  console.log('-'.repeat(w));
  console.log(
    '#'.padEnd(4) +
    'Class'.padEnd(18) +
    'Name'.padEnd(26) +
    'Code'.padEnd(12) +
    'Card Number'.padEnd(16) +
    'Status'.padEnd(10) +
    'Note'
  );
  console.log('-'.repeat(w));
  canTap.forEach((r, i) => {
    console.log(
      String(i + 1).padEnd(4) +
      r.className.padEnd(18) +
      r.name.padEnd(26) +
      r.code.padEnd(12) +
      r.cardNumber.padEnd(16) +
      r.status.padEnd(10) +
      r.reason
    );
  });

  console.log('\n❌  STUDENTS WHO CANNOT TAP IN / OUT  (' + cannotTap.length + ')');
  if (cannotTap.length === 0) {
    console.log('  (none — all students have active cards)');
  } else {
    console.log('-'.repeat(w));
    console.log(
      '#'.padEnd(4) +
      'Class'.padEnd(18) +
      'Name'.padEnd(26) +
      'Code'.padEnd(12) +
      'Card Number'.padEnd(16) +
      'Status'.padEnd(10) +
      'Reason'
    );
    console.log('-'.repeat(w));
    cannotTap.forEach((r, i) => {
      console.log(
        String(i + 1).padEnd(4) +
        r.className.padEnd(18) +
        r.name.padEnd(26) +
        r.code.padEnd(12) +
        r.cardNumber.padEnd(16) +
        r.status.padEnd(10) +
        r.reason
      );
    });
  }

  console.log('\n' + '='.repeat(w));
  console.log('SUMMARY BY CLASS');
  console.log('-'.repeat(w));
  const byClass = {};
  students.forEach(s => {
    const cn = s.class?.name || s.class_id;
    if (!byClass[cn]) byClass[cn] = { total: 0, can: 0 };
    byClass[cn].total++;
    const card = s.card;
    if (card && card.is_active && !card.is_frozen && new Date(card.expires_at) > new Date()) byClass[cn].can++;
  });
  Object.entries(byClass).forEach(([name, stat]) => {
    const bar = '█'.repeat(stat.can) + '░'.repeat(stat.total - stat.can);
    console.log(`  ${name.padEnd(20)} ${String(stat.can).padStart(2)}/${stat.total} can tap  [${bar}]`);
  });
  console.log('='.repeat(w));
}

main().catch(console.error).finally(() => process.exit());
