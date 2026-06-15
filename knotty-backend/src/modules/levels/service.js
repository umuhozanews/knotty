const prisma = require('../../config/database');

async function createLevel(data, schoolId) {
  return prisma.level.create({ data: { ...data, school_id: schoolId } });
}

async function getLevels(schoolId) {
  return prisma.level.findMany({
    where: { school_id: schoolId },
    include: { _count: { select: { classes: true, students: true } } },
    orderBy: [
      { order_index: 'asc' },
      { name: 'asc' },
    ],
  });
}

async function createClass(data, schoolId) {
  return prisma.class.create({
    data: { academic_year: '2025-2026', ...data, school_id: schoolId },
    include: { level: true },
  });
}

async function getClasses(schoolId, user) {
  if (user && user.role === 'TEACHER') {
    const teacher = await prisma.teacher.findFirst({
      where: { user_id: user.id, school_id: schoolId }
    });
    if (!teacher || !teacher.subjects_taught) {
      return [];
    }
    const assignments = teacher.subjects_taught;
    if (!Array.isArray(assignments)) {
      return [];
    }
    const classIds = assignments.map(a => a.class_id).filter(Boolean);
    if (classIds.length === 0) {
      return [];
    }
    return prisma.class.findMany({
      where: { school_id: schoolId, id: { in: classIds } },
      include: {
        level: true,
        _count: { select: { students: true } },
      },
      orderBy: { created_at: 'asc' },
    });
  }

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

  return prisma.$transaction(async (tx) => {
    const classes = await tx.class.findMany({ where: { level_id: id } });
    const classIds = classes.map((c) => c.id);

    const students = await tx.student.findMany({
      where: {
        OR: [
          { level_id: id },
          { class_id: { in: classIds } }
        ]
      }
    });
    const studentIds = students.map((s) => s.id);
    const userIds = students.map((s) => s.user_id);

    if (studentIds.length > 0) {
      await tx.attendance.deleteMany({ where: { student_id: { in: studentIds } } });
      await tx.feePayment.deleteMany({ where: { student_id: { in: studentIds } } });
      await tx.canteenTransaction.deleteMany({ where: { student_id: { in: studentIds } } });
      await tx.walletTransaction.deleteMany({ where: { student_id: { in: studentIds } } });
      await tx.healthRecord.deleteMany({ where: { student_id: { in: studentIds } } });
      await tx.disciplineRecord.deleteMany({ where: { student_id: { in: studentIds } } });
      await tx.achievement.deleteMany({ where: { student_id: { in: studentIds } } });
      await tx.academicReport.deleteMany({ where: { student_id: { in: studentIds } } });
      await tx.knottyCard.deleteMany({ where: { student_id: { in: studentIds } } });
      await tx.student.deleteMany({ where: { id: { in: studentIds } } });
      await tx.user.deleteMany({ where: { id: { in: userIds } } });
    }

    await tx.material.deleteMany({
      where: {
        OR: [
          { level_id: id },
          { class_id: { in: classIds } }
        ]
      }
    });

    await tx.subject.deleteMany({ where: { level_id: id } });
    await tx.class.deleteMany({ where: { level_id: id } });
    return tx.level.delete({ where: { id } });
  });
}

async function deleteClass(id, schoolId) {
  const cls = await prisma.class.findFirst({ where: { id, school_id: schoolId } });
  if (!cls) throw Object.assign(new Error('Class not found'), { status: 404 });

  return prisma.$transaction(async (tx) => {
    const students = await tx.student.findMany({ where: { class_id: id } });
    const studentIds = students.map((s) => s.id);
    const userIds = students.map((s) => s.user_id);

    if (studentIds.length > 0) {
      // Get cards and card IDs
      const studentCards = await tx.knottyCard.findMany({
        where: { student_id: { in: studentIds } },
        select: { id: true }
      });
      const cardIds = studentCards.map(c => c.id);

      // 1. Delete borrow records
      await tx.borrowRecord.deleteMany({ where: { student_id: { in: studentIds } } });
      
      // 2. Delete clinic visits, medication administrations, immunizations, medical profiles
      await tx.medicationAdministration.deleteMany({ where: { student_id: { in: studentIds } } });
      await tx.clinicVisit.deleteMany({ where: { student_id: { in: studentIds } } });
      await tx.immunizationRecord.deleteMany({ where: { student_id: { in: studentIds } } });
      await tx.medicalProfile.deleteMany({ where: { student_id: { in: studentIds } } });

      // 3. Delete exam results, enrollments, consent records
      await tx.examResult.deleteMany({ where: { student_id: { in: studentIds } } });
      await tx.enrollment.deleteMany({ where: { student_id: { in: studentIds } } });
      await tx.consentRecord.deleteMany({ where: { student_id: { in: studentIds } } });

      // 4. Delete access logs referencing student cards
      if (cardIds.length > 0) {
        await tx.accessLog.deleteMany({ where: { card_id: { in: cardIds } } });
      }

      // 5. Delete payments and refund requests referencing wallet transactions
      const walletTxns = await tx.walletTransaction.findMany({
        where: { student_id: { in: studentIds } },
        select: { id: true }
      });
      const walletTxnIds = walletTxns.map(w => w.id);

      if (walletTxnIds.length > 0) {
        await tx.refundRequest.deleteMany({ where: { wallet_transaction_id: { in: walletTxnIds } } });
        await tx.payment.deleteMany({ where: { wallet_transaction_id: { in: walletTxnIds } } });
      }

      // 6. Delete payments referencing invoices of these students
      const invoices = await tx.invoice.findMany({
        where: { student_id: { in: studentIds } },
        select: { id: true }
      });
      const invoiceIds = invoices.map(i => i.id);

      if (invoiceIds.length > 0) {
        await tx.payment.deleteMany({ where: { invoice_id: { in: invoiceIds } } });
        await tx.invoiceLine.deleteMany({ where: { invoice_id: { in: invoiceIds } } });
        await tx.invoice.deleteMany({ where: { id: { in: invoiceIds } } });
      }

      // 7. Delete canteen transactions
      await tx.canteenTransaction.deleteMany({ where: { student_id: { in: studentIds } } });

      // 8. Delete wallet transactions and knotty cards
      await tx.walletTransaction.deleteMany({ where: { student_id: { in: studentIds } } });
      await tx.knottyCard.deleteMany({ where: { student_id: { in: studentIds } } });

      // 9. Delete core transactions: attendance, fees, health, discipline, achievements, reports
      await tx.attendance.deleteMany({ where: { student_id: { in: studentIds } } });
      await tx.feePayment.deleteMany({ where: { student_id: { in: studentIds } } });
      await tx.healthRecord.deleteMany({ where: { student_id: { in: studentIds } } });
      await tx.disciplineRecord.deleteMany({ where: { student_id: { in: studentIds } } });
      await tx.achievement.deleteMany({ where: { student_id: { in: studentIds } } });
      await tx.academicReport.deleteMany({ where: { student_id: { in: studentIds } } });

      // 10. Delete student and user records
      await tx.student.deleteMany({ where: { id: { in: studentIds } } });
      await tx.user.deleteMany({ where: { id: { in: userIds } } });
    }

    // Delete attendance and reports referencing this class directly
    await tx.attendance.deleteMany({ where: { class_id: id } });
    await tx.academicReport.deleteMany({ where: { class_id: id } });

    // Delete materials of this class
    await tx.material.deleteMany({ where: { class_id: id } });

    // Finally delete the class itself
    return tx.class.delete({ where: { id } });
  });
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
  return prisma.$transaction(async (tx) => {
    const existing = await tx.user.findUnique({ where: { email } });
    if (existing) {
      if (role === 'PARENT' && existing.role === 'PARENT') {
        return existing;
      }
      throw Object.assign(new Error('Email already in use'), { status: 409 });
    }
    const password_hash = await bcrypt.hash(password, 10);
    const user = await tx.user.create({
      data: { email, first_name, last_name, role, password_hash, school_id: schoolId, is_active: true },
      select: { id: true, first_name: true, last_name: true, email: true, role: true, is_active: true, created_at: true },
    });

    if (role === 'TEACHER') {
      let count = await tx.teacher.count({ where: { school_id: schoolId } });
      let employee_code;
      let exists = true;
      while (exists) {
        employee_code = `TCH-${schoolId.slice(0, 4).toUpperCase()}-${String(count + 1).padStart(4, '0')}`;
        const existingCode = await tx.teacher.findUnique({ where: { employee_code } });
        if (!existingCode) {
          exists = false;
        } else {
          count++;
        }
      }
      await tx.teacher.create({
        data: {
          user_id: user.id,
          school_id: schoolId,
          employee_code,
          is_active: true,
        }
      });
    }

    return user;
  });
}

async function toggleStaffActive(id, schoolId) {
  const user = await prisma.user.findFirst({ where: { id, school_id: schoolId } });
  if (!user) throw Object.assign(new Error('User not found'), { status: 404 });
  return prisma.user.update({ where: { id }, data: { is_active: !user.is_active }, select: { id: true, is_active: true } });
}

module.exports = { createLevel, getLevels, deleteLevel, createClass, getClasses, deleteClass, getClassStudents, getStaff, createStaff, toggleStaffActive };
