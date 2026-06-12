const prisma = require('../../config/database');
const momoService = require('../../integrations/mtn-momo');
const { paginate, paginatedResponse } = require('../../utils/helpers');

async function initiatePayment({ student_id, school_id, amount, payment_type, payment_method, term, academic_year, phone }) {
  const student = await prisma.student.findFirst({ where: { id: student_id, school_id } });
  if (!student) throw Object.assign(new Error('Student not found'), { status: 404 });

  const payment = await prisma.feePayment.create({
    data: { student_id, school_id, amount, payment_type, payment_method, term, academic_year, status: 'PENDING' },
  });

  if (payment_method === 'MOMO') {
    const momoRef = await momoService.requestTopUp({
      amount,
      phone,
      referenceId: payment.id,
      description: `${payment_type} payment — ${term} ${academic_year}`,
    });
    await prisma.feePayment.update({
      where: { id: payment.id },
      data: { momo_transaction_id: momoRef },
    });
    return { payment, momoRef, message: 'MoMo payment request sent' };
  }

  if (payment_method === 'CASH') {
    await prisma.feePayment.update({
      where: { id: payment.id },
      data: { status: 'COMPLETED', paid_at: new Date() },
    });
    return { payment: { ...payment, status: 'COMPLETED' }, message: 'Cash payment recorded' };
  }

  return { payment, message: 'Payment initiated' };
}

async function verifyMomoPayment(momoReference) {
  const payment = await prisma.feePayment.findFirst({ where: { momo_transaction_id: momoReference } });
  if (!payment) throw Object.assign(new Error('Payment not found'), { status: 404 });

  const status = await momoService.getTransactionStatus(momoReference);
  if (status.status === 'SUCCESSFUL') {
    return prisma.feePayment.update({
      where: { id: payment.id },
      data: { status: 'COMPLETED', paid_at: new Date() },
    });
  }
  if (status.status === 'FAILED') {
    return prisma.feePayment.update({ where: { id: payment.id }, data: { status: 'FAILED' } });
  }
  return payment;
}

async function getStudentFees(studentId, { page, limit }) {
  const { skip, take } = paginate(null, page, limit);
  const [data, total] = await Promise.all([
    prisma.feePayment.findMany({
      where: { student_id: studentId },
      skip,
      take,
      orderBy: { created_at: 'desc' },
    }),
    prisma.feePayment.count({ where: { student_id: studentId } }),
  ]);
  return paginatedResponse(data, total, page, limit);
}

async function getSchoolFeeReport(schoolId) {
  const [total_collected, pending, by_type, total_students] = await Promise.all([
    prisma.feePayment.aggregate({
      where: { school_id: schoolId, status: 'COMPLETED' },
      _sum: { amount: true },
    }),
    prisma.feePayment.aggregate({
      where: { school_id: schoolId, status: 'PENDING' },
      _sum: { amount: true },
    }),
    prisma.feePayment.groupBy({
      by: ['payment_type'],
      where: { school_id: schoolId, status: 'COMPLETED' },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.student.count({
      where: { school_id: schoolId, is_active: true },
    }),
  ]);
  return {
    total_collected: total_collected._sum.amount || 0,
    pending: pending._sum.amount || 0,
    by_type,
    total_students,
  };
}

module.exports = { initiatePayment, verifyMomoPayment, getStudentFees, getSchoolFeeReport };
