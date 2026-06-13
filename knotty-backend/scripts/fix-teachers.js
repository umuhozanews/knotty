require('dotenv').config();
const prisma = require('../src/config/database');

async function fixTeachers() {
  console.log('Finding teachers without profiles...');
  const teachersUsers = await prisma.user.findMany({
    where: {
      role: 'TEACHER',
      teacher: null,
    },
    include: {
      teacher: true,
    },
  });

  console.log(`Found ${teachersUsers.length} user(s) with role TEACHER and no Teacher profile.`);

  for (const user of teachersUsers) {
    let count = await prisma.teacher.count({ where: { school_id: user.school_id } });
    let employee_code;
    let exists = true;
    while (exists) {
      employee_code = `TCH-${user.school_id.slice(0, 4).toUpperCase()}-${String(count + 1).padStart(4, '0')}`;
      const existingCode = await prisma.teacher.findUnique({ where: { employee_code } });
      if (!existingCode) {
        exists = false;
      } else {
        count++;
      }
    }
    
    await prisma.teacher.create({
      data: {
        user_id: user.id,
        school_id: user.school_id,
        employee_code,
        is_active: true,
      },
    });
    console.log(`Created Teacher profile for ${user.first_name} ${user.last_name} (${user.email}) with employee code ${employee_code}.`);
  }
}

fixTeachers()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
