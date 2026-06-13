const prisma = require('../../config/database');

async function createLevel(data, schoolId) {
  return prisma.level.create({ data: { ...data, school_id: schoolId } });
}

async function getLevels(schoolId) {
  return prisma.level.findMany({
    where: { school_id: schoolId },
    include: { _count: { select: { classes: true, students: true } } },
    orderBy: { order_index: 'asc' },
  });
}

async function createClass(data, schoolId) {
  return prisma.class.create({
    data: { academic_year: '2025-2026', ...data, school_id: schoolId },
    include: { level: true },
  });
}

async function getClasses(schoolId) {
  return prisma.class.findMany({
    where: { school_id: schoolId },
    include: {
      level: true,
      _count: { select: { students: true } },
    },
    orderBy: { created_at: 'asc' },
  });
}

async function getClassStudents(classId, schoolId) {
  return prisma.student.findMany({
    where: { class_id: classId, school_id: schoolId, is_active: true },
    include: {
      user: { select: { first_name: true, last_name: true, profile_photo: true } },
      card: { select: { wallet_balance: true, is_active: true } },
    },
    orderBy: { created_at: 'asc' },
  });
}

async function deleteLevel(id, schoolId) {
  const level = await prisma.level.findFirst({ where: { id, school_id: schoolId } });
  if (!level) throw Object.assign(new Error('Level not found'), { status: 404 });
  return prisma.level.delete({ where: { id } });
}

async function deleteClass(id, schoolId) {
  const cls = await prisma.class.findFirst({ where: { id, school_id: schoolId } });
  if (!cls) throw Object.assign(new Error('Class not found'), { status: 404 });
  return prisma.class.delete({ where: { id } });
}

async function getStaff(schoolId) {
  return prisma.user.findMany({
    where: { school_id: schoolId, role: { in: ['TEACHER', 'CANTEEN', 'NURSE', 'ADMIN'] } },
    select: { id: true, first_name: true, last_name: true, email: true, role: true, is_active: true, last_login: true, created_at: true },
    orderBy: { created_at: 'asc' },
  });
}

async function createStaff({ email, first_name, last_name, role, password }, schoolId) {
  const bcrypt = require('bcryptjs');
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    if (role === 'PARENT' && existing.role === 'PARENT') {
      return existing;
    }
    throw Object.assign(new Error('Email already in use'), { status: 409 });
  }
  const password_hash = await bcrypt.hash(password, 10);
  return prisma.user.create({
    data: { email, first_name, last_name, role, password_hash, school_id: schoolId, is_active: true },
    select: { id: true, first_name: true, last_name: true, email: true, role: true, is_active: true, created_at: true },
  });
}

async function toggleStaffActive(id, schoolId) {
  const user = await prisma.user.findFirst({ where: { id, school_id: schoolId } });
  if (!user) throw Object.assign(new Error('User not found'), { status: 404 });
  return prisma.user.update({ where: { id }, data: { is_active: !user.is_active }, select: { id: true, is_active: true } });
}

module.exports = { createLevel, getLevels, deleteLevel, createClass, getClasses, deleteClass, getClassStudents, getStaff, createStaff, toggleStaffActive };
