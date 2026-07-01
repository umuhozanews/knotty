const prisma = require('../config/database');

async function fixTeachers() {
  try {
    console.log('[FixTeachers] Checking for teacher users without teacher profiles...');
    const teachersUsers = await prisma.user.findMany({
      where: {
        role: 'TEACHER',
        teacher: null,
      },
      include: {
        teacher: true,
      },
    });

    if (teachersUsers.length === 0) {
      console.log('[FixTeachers] No teacher users missing profiles.');
      return;
    }

    console.log(`[FixTeachers] Found ${teachersUsers.length} user(s) with role TEACHER and no Teacher profile.`);

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
      
      const classes = await prisma.class.findMany({ where: { school_id: user.school_id } });
      const subjects_taught = classes.map(c => ({ class_id: c.id, subject: 'General Subject' }));
      
      await prisma.teacher.create({
        data: {
          user_id: user.id,
          school_id: user.school_id,
          employee_code,
          subjects_taught,
          is_active: true,
        },
      });
      console.log(`[FixTeachers] Created Teacher profile for ${user.first_name} ${user.last_name} (${user.email}) with employee code ${employee_code}.`);
    }
  } catch (err) {
    console.error('[FixTeachers] Error fixing teacher profiles:', err);
  }
}

module.exports = fixTeachers;
