const prisma = require('../../config/database');
const momoService = require('../../integrations/mtn-momo');
const { paginate, paginatedResponse } = require('../../utils/helpers');
const { logAction } = require('../../utils/audit');

// ─── Legacy/Compatibility Functions ───

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
  if (payment) {
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

  // Also check new Invoice payments
  const invoicePayment = await prisma.payment.findFirst({
    where: { id: momoReference },
    include: { invoice: true },
  });
  if (invoicePayment) {
    const status = await momoService.getTransactionStatus(momoReference);
    if (status.status === 'SUCCESSFUL') {
      const updatedPayment = await prisma.payment.update({
        where: { id: invoicePayment.id },
        data: { status: 'COMPLETED' },
      });

      // Update invoice amount_paid
      if (invoicePayment.invoice_id) {
        const inv = await prisma.invoice.findUnique({ where: { id: invoicePayment.invoice_id } });
        const newPaid = inv.amount_paid + invoicePayment.amount;
        let newStatus = 'PARTIAL';
        if (newPaid >= inv.total_amount) newStatus = 'PAID';

        await prisma.invoice.update({
          where: { id: invoicePayment.invoice_id },
          data: { amount_paid: newPaid, status: newStatus },
        });
      }

      return updatedPayment;
    }
    if (status.status === 'FAILED') {
      return prisma.payment.update({
        where: { id: invoicePayment.id },
        data: { status: 'FAILED' },
      });
    }
    return invoicePayment;
  }

  throw Object.assign(new Error('Payment not found'), { status: 404 });
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

  // Include Invoices total
  const [invoiceCollected, invoicePending] = await Promise.all([
    prisma.invoice.aggregate({
      where: { school_id: schoolId },
      _sum: { amount_paid: true },
    }),
    prisma.invoice.findMany({
      where: { school_id: schoolId },
      select: { total_amount: true, amount_paid: true },
    }),
  ]);

  const totalInvoiceCollected = invoiceCollected._sum.amount_paid || 0;
  const totalInvoicePending = invoicePending.reduce((sum, inv) => sum + Math.max(0, inv.total_amount - inv.amount_paid), 0);

  return {
    total_collected: (total_collected._sum.amount || 0) + totalInvoiceCollected,
    pending: (pending._sum.amount || 0) + totalInvoicePending,
    by_type,
    total_students,
  };
}

// ─── NEW Structured Invoicing & Refunds ───

// Fee Structures
async function listFeeStructures(schoolId) {
  return prisma.feeStructure.findMany({
    where: { school_id: schoolId },
    orderBy: { created_at: 'desc' },
  });
}

async function createFeeStructure(schoolId, data) {
  return prisma.feeStructure.create({
    data: {
      school_id: schoolId,
      name: data.name,
      academic_term_id: data.academic_term_id || null,
      applies_to: data.applies_to || null, // Array of level/class/program IDs/Names
      amount: Number(data.amount),
      currency: data.currency || 'RWF',
    },
  });
}

async function deleteFeeStructure(id, schoolId) {
  return prisma.feeStructure.delete({
    where: { id, school_id: schoolId },
  });
}

// Invoices
async function listInvoices(schoolId, { studentId, classSectionId, termId, status } = {}) {
  const where = { school_id: schoolId };
  if (studentId) where.student_id = studentId;
  if (termId) where.academic_term_id = termId;
  if (status) where.status = status;

  if (classSectionId) {
    // get students in class section
    const enrollments = await prisma.enrollment.findMany({
      where: { class_section_id: classSectionId, status: 'ACTIVE' },
      select: { student_id: true },
    });
    where.student_id = { in: enrollments.map(e => e.student_id) };
  }

  return prisma.invoice.findMany({
    where,
    include: {
      student: {
        include: {
          user: { select: { first_name: true, last_name: true } },
          class: { select: { name: true } },
        },
      },
      lines: {
        include: { fee_structure: true },
      },
      payments: true,
    },
    orderBy: { created_at: 'desc' },
  });
}

async function generateInvoices(schoolId, { fee_structure_id, due_date }) {
  const structure = await prisma.feeStructure.findFirst({
    where: { id: fee_structure_id, school_id: schoolId },
  });
  if (!structure) throw Object.assign(new Error('Fee structure not found'), { status: 404 });

  const appliesTo = structure.applies_to;
  let students = [];

  if (!appliesTo || (Array.isArray(appliesTo) && appliesTo.length === 0)) {
    students = await prisma.student.findMany({
      where: { school_id: schoolId, is_active: true },
    });
  } else {
    // Find students whose level/class or level_id/class_id match appliesTo
    students = await prisma.student.findMany({
      where: {
        school_id: schoolId,
        is_active: true,
        OR: [
          { level: { name: { in: appliesTo } } },
          { level_id: { in: appliesTo } },
          { class: { name: { in: appliesTo } } },
          { class_id: { in: appliesTo } },
        ],
      },
    });
  }

  let count = 0;
  const createdInvoices = [];

  for (const student of students) {
    // Check if invoice line for this structure already exists for student
    const existing = await prisma.invoice.findFirst({
      where: {
        student_id: student.id,
        lines: {
          some: { fee_structure_id },
        },
      },
    });

    if (existing) continue; // Already invoiced for this structure

    const invoice = await prisma.invoice.create({
      data: {
        school_id: schoolId,
        student_id: student.id,
        academic_term_id: structure.academic_term_id,
        total_amount: structure.amount,
        due_date: new Date(due_date),
        lines: {
          create: {
            fee_structure_id,
            description: structure.name,
            amount: structure.amount,
          },
        },
      },
      include: { lines: true },
    });

    createdInvoices.push(invoice);
    count++;
  }

  return { count, invoices: createdInvoices };
}

// Invoices Payments
async function payInvoice(schoolId, payerUserId, { invoice_id, amount, channel, phone }) {
  const invoice = await prisma.invoice.findFirst({
    where: { id: invoice_id, school_id: schoolId },
    include: { student: { include: { card: true } } },
  });
  if (!invoice) throw Object.assign(new Error('Invoice not found'), { status: 404 });

  const remaining = invoice.total_amount - invoice.amount_paid;
  if (remaining <= 0) throw Object.assign(new Error('Invoice is already paid'), { status: 400 });
  if (amount > remaining) throw Object.assign(new Error(`Amount exceeds remaining balance of ${remaining}`), { status: 400 });

  if (channel === 'WALLET') {
    const card = invoice.student.card;
    if (!card) throw Object.assign(new Error('Student does not have a linked Knotty Card'), { status: 400 });
    if (card.is_frozen || !card.is_active) throw Object.assign(new Error('Knotty Card is frozen or inactive'), { status: 400 });
    if (card.wallet_balance < amount) throw Object.assign(new Error(`Insufficient wallet balance (${card.wallet_balance} RWF)`), { status: 400 });

    // Deduct from wallet and record transaction
    const balanceBefore = card.wallet_balance;
    const balanceAfter = card.wallet_balance - amount;

    const [updatedCard, walletTx, payment] = await prisma.$transaction([
      prisma.knottyCard.update({
        where: { id: card.id },
        data: { wallet_balance: balanceAfter },
      }),
      prisma.walletTransaction.create({
        data: {
          card_id: card.id,
          student_id: invoice.student_id,
          school_id: schoolId,
          type: 'DEDUCTION',
          amount,
          balance_before: balanceBefore,
          balance_after: balanceAfter,
          source: 'ADMIN',
          description: `Fee Payment for Invoice #${invoice.id.substring(0, 8)}`,
        },
      }),
      prisma.payment.create({
        data: {
          school_id: schoolId,
          invoice_id,
          amount,
          channel: 'WALLET',
          status: 'COMPLETED',
          payer_user_id: payerUserId,
        },
      }),
    ]);

    // Link payment to wallet transaction
    await prisma.payment.update({
      where: { id: payment.id },
      data: { wallet_transaction_id: walletTx.id },
    });

    // Update invoice amount_paid
    const newPaid = invoice.amount_paid + amount;
    const newStatus = newPaid >= invoice.total_amount ? 'PAID' : 'PARTIAL';
    await prisma.invoice.update({
      where: { id: invoice_id },
      data: { amount_paid: newPaid, status: newStatus },
    });

    await logAction({
      school_id: schoolId,
      actor_user_id: payerUserId,
      action: 'FEE_PAYMENT_WALLET',
      entity_type: 'Invoice',
      entity_id: invoice_id,
      after_state: { payment, walletTx },
    });

    return { payment, new_balance: updatedCard.wallet_balance, message: 'Fee paid successfully via Knotty Card Wallet' };
  }

  if (channel === 'MOMO') {
    if (!phone) throw Object.assign(new Error('Phone number is required for MTN MoMo payment'), { status: 400 });

    const payment = await prisma.payment.create({
      data: {
        school_id: schoolId,
        invoice_id,
        amount,
        channel: 'MOMO',
        status: 'PENDING',
        payer_user_id: payerUserId,
      },
    });

    try {
      const momoRef = await momoService.requestTopUp({
        amount,
        phone,
        referenceId: payment.id,
        description: `Fee Invoice Payment`,
      });
      return { payment, momoRef, message: 'MoMo payment request sent successfully' };
    } catch (err) {
      await prisma.payment.update({ where: { id: payment.id }, data: { status: 'FAILED' } });
      throw err;
    }
  }

  // CASH / BANK
  const payment = await prisma.payment.create({
    data: {
      school_id: schoolId,
      invoice_id,
      amount,
      channel,
      status: 'COMPLETED',
      payer_user_id: payerUserId,
    },
  });

  const newPaid = invoice.amount_paid + amount;
  const newStatus = newPaid >= invoice.total_amount ? 'PAID' : 'PARTIAL';
  await prisma.invoice.update({
    where: { id: invoice_id },
    data: { amount_paid: newPaid, status: newStatus },
  });

  await logAction({
    school_id: schoolId,
    actor_user_id: payerUserId,
    action: `FEE_PAYMENT_${channel}`,
    entity_type: 'Invoice',
    entity_id: invoice_id,
    after_state: { payment },
  });

  return { payment, message: `Payment recorded via ${channel}` };
}

// Refunds Management
async function listRefundRequests(schoolId) {
  return prisma.refundRequest.findMany({
    where: { school_id: schoolId },
    include: {
      wallet_transaction: {
        include: {
          student: { include: { user: { select: { first_name: true, last_name: true } } } },
        },
      },
      requester: { select: { first_name: true, last_name: true } },
      approver: { select: { first_name: true, last_name: true } },
    },
    orderBy: { created_at: 'desc' },
  });
}

async function requestRefund(schoolId, requesterUserId, { wallet_transaction_id, reason }) {
  const tx = await prisma.walletTransaction.findFirst({
    where: { id: wallet_transaction_id, school_id: schoolId },
  });
  if (!tx) throw Object.assign(new Error('Wallet transaction not found'), { status: 404 });

  // Prevent multiple refunds for same tx
  const existing = await prisma.refundRequest.findFirst({
    where: { wallet_transaction_id, status: { in: ['PENDING', 'APPROVED'] } },
  });
  if (existing) throw Object.assign(new Error('Refund has already been requested or approved for this transaction'), { status: 400 });

  return prisma.refundRequest.create({
    data: {
      school_id: schoolId,
      wallet_transaction_id,
      requested_by: requesterUserId,
      reason,
      status: 'PENDING',
    },
  });
}

async function resolveRefund(schoolId, approverUserId, refundId, { status }) {
  if (!['APPROVED', 'REJECTED'].includes(status)) throw Object.assign(new Error('Invalid refund status decision'), { status: 400 });

  const refund = await prisma.refundRequest.findFirst({
    where: { id: refundId, school_id: schoolId },
    include: { wallet_transaction: { include: { card: true } } },
  });
  if (!refund) throw Object.assign(new Error('Refund request not found'), { status: 404 });
  if (refund.status !== 'PENDING') throw Object.assign(new Error('Refund has already been resolved'), { status: 400 });

  if (status === 'REJECTED') {
    return prisma.refundRequest.update({
      where: { id: refundId },
      data: {
        status: 'REJECTED',
        approved_by: approverUserId,
        resolved_at: new Date(),
      },
    });
  }

  // APPROVED refund
  const tx = refund.wallet_transaction;
  const card = tx.card;

  // Perform balance reversal if it was a deduction
  let updatedCard = card;
  let refundTx = null;

  if (tx.type === 'DEDUCTION') {
    const balanceBefore = card.wallet_balance;
    const balanceAfter = card.wallet_balance + tx.amount;

    // Check if this wallet transaction was linked to an Invoice Payment
    const payment = await prisma.payment.findFirst({
      where: { wallet_transaction_id: tx.id },
      include: { invoice: true },
    });

    await prisma.$transaction(async (txPrisma) => {
      // 1. Revert card balance
      updatedCard = await txPrisma.knottyCard.update({
        where: { id: card.id },
        data: { wallet_balance: balanceAfter },
      });

      // 2. Create REFUND WalletTransaction
      refundTx = await txPrisma.walletTransaction.create({
        data: {
          card_id: card.id,
          student_id: tx.student_id,
          school_id: schoolId,
          type: 'REFUND',
          amount: tx.amount,
          balance_before: balanceBefore,
          balance_after: balanceAfter,
          source: 'ADMIN',
          description: `Refund for Transaction #${tx.id.substring(0, 8)}`,
        },
      });

      // 3. Revert Invoice Payment if exists
      if (payment && payment.invoice) {
        const inv = payment.invoice;
        const newPaid = Math.max(0, inv.amount_paid - payment.amount);
        const newStatus = newPaid <= 0 ? 'UNPAID' : 'PARTIAL';

        await txPrisma.invoice.update({
          where: { id: inv.id },
          data: { amount_paid: newPaid, status: newStatus },
        });

        await txPrisma.payment.update({
          where: { id: payment.id },
          data: { status: 'FAILED' }, // Mark payment failed to reflect refund
        });
      }
    });
  }

  const updatedRefund = await prisma.refundRequest.update({
    where: { id: refundId },
    data: {
      status: 'APPROVED',
      approved_by: approverUserId,
      resolved_at: new Date(),
    },
  });

  await logAction({
    school_id: schoolId,
    actor_user_id: approverUserId,
    action: 'REFUND_APPROVED',
    entity_type: 'RefundRequest',
    entity_id: refundId,
    before_state: refund,
    after_state: { refund: updatedRefund, refundTx },
  });

  return { refund: updatedRefund, balance: updatedCard.wallet_balance };
}

module.exports = {
  // Legacy compatibility
  initiatePayment,
  verifyMomoPayment,
  getStudentFees,
  getSchoolFeeReport,

  // Fee structures
  listFeeStructures,
  createFeeStructure,
  deleteFeeStructure,

  // Invoices
  listInvoices,
  generateInvoices,
  payInvoice,

  // Refunds
  listRefundRequests,
  requestRefund,
  resolveRefund,
};
