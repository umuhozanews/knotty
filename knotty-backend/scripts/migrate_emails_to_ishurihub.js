require('dotenv').config();
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Migrating database emails to IshuriHUB domains...');

  // 1. Update School email
  const school = await prisma.school.findFirst();
  if (school) {
    await prisma.school.update({
      where: { id: school.id },
      data: {
        email: 'admin@ishurihub.rw',
        name: 'IshuriHUB Model School',
      },
    });
    console.log(`✓ Updated school email: admin@ishurihub.rw`);
  }

  // 2. Fetch all users
  const users = await prisma.user.findMany();
  let updatedCount = 0;

  const adminHash = await bcrypt.hash('Admin@2024', 10);
  const staffHash = await bcrypt.hash('Staff@2024', 10);
  const studentHash = await bcrypt.hash('Student@2024', 10);

  for (const user of users) {
    let newEmail = user.email;

    if (newEmail === 'admin@knottyschool.rw') {
      newEmail = 'admin@ishurihub.rw';
    } else if (newEmail.endsWith('@knottyschool.rw')) {
      newEmail = newEmail.replace('@knottyschool.rw', '@ishurihub.rw');
    } else if (newEmail.endsWith('@parent.knotty.rw')) {
      newEmail = newEmail.replace('@parent.knotty.rw', '@parent.ishurihub.rw');
    } else if (newEmail.endsWith('@student.knotty.rw')) {
      newEmail = newEmail.replace('@student.knotty.rw', '@student.ishurihub.rw');
    } else if (newEmail.endsWith('@knotty.rw')) {
      newEmail = newEmail.replace('@knotty.rw', '@ishurihub.rw');
    }

    let passwordHash = user.password_hash;
    if (user.role === 'ADMIN' || newEmail === 'admin@ishurihub.rw') {
      passwordHash = adminHash;
    } else if (['TEACHER', 'BURSAR', 'NURSE', 'DISCIPLINE', 'CANTEEN', 'LIBRARIAN'].includes(user.role)) {
      passwordHash = staffHash;
    } else if (user.role === 'STUDENT' && user.email.includes('hirwa')) {
      passwordHash = studentHash;
    }

    if (newEmail !== user.email || passwordHash !== user.password_hash) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          email: newEmail,
          password_hash: passwordHash,
          is_active: true,
        },
      });
      updatedCount++;
    }
  }

  console.log(`✓ Updated ${updatedCount} users to @ishurihub.rw domains and ensured valid passwords`);

  // Verify admin account
  const admin = await prisma.user.findUnique({ where: { email: 'admin@ishurihub.rw' } });
  console.log('Admin user verified:', admin ? { id: admin.id, email: admin.email, role: admin.role, active: admin.is_active } : 'NOT FOUND');
}

main()
  .catch((e) => {
    console.error('Migration failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
