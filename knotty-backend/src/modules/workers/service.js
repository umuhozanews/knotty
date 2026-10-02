const bcrypt = require('bcryptjs');
const prisma = require('../../config/database');
const { paginate, paginatedResponse } = require('../../utils/helpers');

// Supported worker/staff roles
const WORKER_ROLES = ['TEACHER', 'CANTEEN', 'BURSAR', 'NURSE', 'DISCIPLINE', 'LIBRARIAN', 'ADMIN'];

async function list(schoolId, { page = 1, limit = 50, role, search, status }) {
  const { skip, take } = paginate(null, page, limit);

  const where = {
    school_id: schoolId,
    role: role && WORKER_ROLES.includes(role) ? role : { in: WORKER_ROLES },
  };

  if (status === 'ACTIVE') where.is_active = true;
  if (status === 'INACTIVE') where.is_active = false;

  if (search) {
    const s = String(search).trim();
    where.OR = [
      { first_name: { contains: s, mode: 'insensitive' } },
      { last_name: { contains: s, mode: 'insensitive' } },
      { email: { contains: s, mode: 'insensitive' } },
      { phone: { contains: s, mode: 'insensitive' } },
    ];
  }

  const [users, total, statsCounts] = await Promise.all([
    prisma.user.findMany({
      where,
      skip,
      take,
      include: {
        teacher: true,
        staff: true,
      },
      orderBy: { created_at: 'desc' },
    }),
    prisma.user.count({ where }),
    // Aggregate summary stats for the active school
    Promise.all([
      prisma.user.count({ where: { school_id: schoolId, role: { in: WORKER_ROLES } } }),
      prisma.user.count({ where: { school_id: schoolId, role: 'TEACHER' } }),
      prisma.user.count({ where: { school_id: schoolId, role: 'CANTEEN' } }),
      prisma.user.count({ where: { school_id: schoolId, role: { in: ['BURSAR', 'NURSE', 'DISCIPLINE', 'LIBRARIAN'] } } }),
      prisma.user.count({ where: { school_id: schoolId, role: { in: WORKER_ROLES }, is_active: true } }),
    ]),
  ]);

  const [totalWorkers, totalTeachers, totalCantiniers, totalSupport, activeWorkers] = statsCounts;

  const data = users.map((u) => {
    let employeeCode = u.teacher?.employee_code || u.staff?.staff_number;
    if (!employeeCode) {
      const prefix = u.role.slice(0, 3).toUpperCase();
      employeeCode = `${prefix}-${u.school_id.slice(0, 4).toUpperCase()}-${u.id.slice(0, 4).toUpperCase()}`;
    }

    let department = u.staff?.department;
    if (!department) {
      if (u.role === 'TEACHER') department = u.teacher?.specialization || 'Academic & Teaching';
      else if (u.role === 'CANTEEN') department = 'Canteen & Food Services';
      else if (u.role === 'BURSAR') department = 'Finance & Accounts';
      else if (u.role === 'NURSE') department = 'Health & Infirmary';
      else if (u.role === 'DISCIPLINE') department = 'Student Welfare & Discipline';
      else if (u.role === 'LIBRARIAN') department = 'Library & Media';
      else if (u.role === 'ADMIN') department = 'Executive School Administration';
      else department = 'General Operations';
    }

    return {
      id: u.id,
      user_id: u.id,
      school_id: u.school_id,
      role: u.role,
      first_name: u.first_name,
      last_name: u.last_name,
      full_name: `${u.first_name} ${u.last_name}`,
      email: u.email,
      phone: u.phone,
      employee_code: employeeCode,
      department,
      job_title: u.staff?.job_title || (u.role === 'TEACHER' ? 'Instructor / Teacher' : u.role === 'CANTEEN' ? 'Cantinier' : u.role),
      is_active: u.is_active,
      status: u.is_active ? 'ACTIVE' : 'INACTIVE',
      last_login: u.last_login,
      created_at: u.created_at,
      teacher_details: u.teacher,
    };
  });

  const response = paginatedResponse(data, total, page, limit);
  response.stats = {
    total_workers: totalWorkers,
    total_teachers: totalTeachers,
    total_cantiniers: totalCantiniers,
    total_support: totalSupport,
    active_workers: activeWorkers,
  };

  return response;
}

async function create(data, schoolId) {
  const {
    first_name,
    last_name,
    email,
    phone,
    role = 'TEACHER',
    department,
    employee_code,
    job_title,
    password = 'Staff@2024',
    specialization,
  } = data;

  if (!first_name || !last_name || !email) {
    throw Object.assign(new Error('First name, last name, and email are required'), { status: 400 });
  }

  const cleanEmail = String(email).trim().toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email: cleanEmail } });
  if (existing) {
    throw Object.assign(new Error(`User with email ${cleanEmail} already exists`), { status: 409 });
  }

  const password_hash = await bcrypt.hash(password, 10);
  const userRole = WORKER_ROLES.includes(role) ? role : 'TEACHER';

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        school_id: schoolId,
        role: userRole,
        first_name: first_name.trim(),
        last_name: last_name.trim(),
        email: cleanEmail,
        phone: phone ? phone.trim() : null,
        password_hash,
        is_active: true,
      },
    });

    const code = employee_code || `${userRole.slice(0, 3)}-${schoolId.slice(0, 4).toUpperCase()}-${String(Date.now()).slice(-4)}`;

    if (userRole === 'TEACHER') {
      await tx.teacher.create({
        data: {
          user_id: user.id,
          school_id: schoolId,
          employee_code: code,
          specialization: specialization || department || 'General Education',
          qualification: "Bachelor's Degree",
        },
      });
    }

    return {
      id: user.id,
      user_id: user.id,
      school_id: user.school_id,
      role: user.role,
      first_name: user.first_name,
      last_name: user.last_name,
      email: user.email,
      phone: user.phone,
      employee_code: code,
      department: department || 'General Staff',
      job_title: job_title || userRole,
      is_active: user.is_active,
      created_at: user.created_at,
    };
  });
}

async function getOne(id, schoolId) {
  const user = await prisma.user.findFirst({
    where: { id, school_id: schoolId, role: { in: WORKER_ROLES } },
    include: { teacher: true, staff: true },
  });

  if (!user) throw Object.assign(new Error('Worker not found'), { status: 404 });

  let employeeCode = user.teacher?.employee_code || user.staff?.staff_number || `EMP-${user.id.slice(0, 6)}`;
  return {
    id: user.id,
    user_id: user.id,
    school_id: user.school_id,
    role: user.role,
    first_name: user.first_name,
    last_name: user.last_name,
    full_name: `${user.first_name} ${user.last_name}`,
    email: user.email,
    phone: user.phone,
    employee_code: employeeCode,
    department: user.staff?.department || (user.role === 'TEACHER' ? user.teacher?.specialization : user.role),
    is_active: user.is_active,
    last_login: user.last_login,
    created_at: user.created_at,
    teacher: user.teacher,
  };
}

async function update(id, schoolId, data) {
  const { first_name, last_name, phone, role, is_active, department, specialization } = data;

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findFirst({
      where: { id, school_id: schoolId },
      include: { teacher: true },
    });

    if (!user) throw Object.assign(new Error('Worker not found'), { status: 404 });

    const updatedUser = await tx.user.update({
      where: { id },
      data: {
        ...(first_name !== undefined && { first_name: first_name.trim() }),
        ...(last_name !== undefined && { last_name: last_name.trim() }),
        ...(phone !== undefined && { phone: phone.trim() }),
        ...(role !== undefined && WORKER_ROLES.includes(role) && { role }),
        ...(is_active !== undefined && { is_active: Boolean(is_active) }),
      },
    });

    if (user.teacher && (specialization || department)) {
      await tx.teacher.update({
        where: { id: user.teacher.id },
        data: {
          ...(specialization && { specialization }),
          ...(department && { specialization: department }),
        },
      });
    }

    return getOne(id, schoolId);
  });
}

async function remove(id, schoolId) {
  const user = await prisma.user.findFirst({ where: { id, school_id: schoolId } });
  if (!user) throw Object.assign(new Error('Worker not found'), { status: 404 });

  await prisma.user.update({
    where: { id },
    data: { is_active: false },
  });

  return { success: true, message: 'Worker deactivated successfully' };
}

module.exports = { list, create, getOne, update, remove };
