require('dotenv').config();
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const email = 'admin@knottyschool.rw';
  const password = 'Admin@2024';

  const hash = await bcrypt.hash(password, 10);

  const updated = await prisma.user.updateMany({
    where: { email },
    data: { password_hash: hash, is_active: true },
  });

  if (updated.count === 0) {
    console.log('User not found — running full seed instead...');
    require('./seed-fallback');
    return;
  }

  console.log(`✓ Password reset for ${email}`);
  console.log(`  Login: ${email} / ${password}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
