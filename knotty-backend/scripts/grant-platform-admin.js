require('dotenv').config();
const prisma = require('../src/config/database');

async function main() {
  const email = String(process.env.PLATFORM_ADMIN_EMAIL || '').trim().toLowerCase();
  if (!email || process.argv[2] !== '--confirm-platform-admin-grant') {
    throw new Error('Set PLATFORM_ADMIN_EMAIL and pass --confirm-platform-admin-grant');
  }
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, email: true, is_active: true } });
  if (!user || !user.is_active) throw new Error('An existing active user account is required');
  await prisma.platformMembership.upsert({
    where: { user_id: user.id },
    create: { user_id: user.id, role: 'PLATFORM_ADMIN', status: 'ACTIVE' },
    update: { role: 'PLATFORM_ADMIN', status: 'ACTIVE' },
  });
  process.stdout.write(`Platform administrator access granted to ${user.email}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
}).finally(async () => prisma.$disconnect());
