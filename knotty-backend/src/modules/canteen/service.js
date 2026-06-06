const prisma = require('../../config/database');
const { paginate, paginatedResponse } = require('../../utils/helpers');

async function purchase({ card_number, items, served_by, school_id }) {
  const card = await prisma.knottyCard.findUnique({ where: { card_number } });
  if (!card) throw Object.assign(new Error('Card not found'), { status: 404 });
  if (!card.is_active || card.is_frozen) throw Object.assign(new Error('Card not usable'), { status: 403 });

  const total_amount = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  if (card.wallet_balance < total_amount) {
    throw Object.assign(
      new Error(`Insufficient balance. Balance: ${card.wallet_balance} RWF, Required: ${total_amount} RWF`),
      { status: 400 }
    );
  }

  return prisma.$transaction(async (tx) => {
    const updatedCard = await tx.knottyCard.update({
      where: { id: card.id },
      data: { wallet_balance: { decrement: total_amount } },
    });

    const txn = await tx.canteenTransaction.create({
      data: {
        student_id: card.student_id,
        school_id,
        card_id: card.id,
        items_purchased: items,
        total_amount,
        wallet_balance_before: card.wallet_balance,
        wallet_balance_after: updatedCard.wallet_balance,
        served_by,
      },
    });

    await tx.walletTransaction.create({
      data: {
        card_id: card.id,
        student_id: card.student_id,
        school_id,
        type: 'DEDUCTION',
        amount: total_amount,
        balance_before: card.wallet_balance,
        balance_after: updatedCard.wallet_balance,
        source: 'ADMIN',
        description: `Canteen purchase — ${items.length} item(s)`,
      },
    });

    return { transaction: txn, new_balance: updatedCard.wallet_balance };
  });
}

async function getStudentTransactions(studentId, { page, limit }) {
  const { skip, take } = paginate(null, page, limit);
  const [data, total] = await Promise.all([
    prisma.canteenTransaction.findMany({
      where: { student_id: studentId },
      skip,
      take,
      orderBy: { transaction_time: 'desc' },
    }),
    prisma.canteenTransaction.count({ where: { student_id: studentId } }),
  ]);
  return paginatedResponse(data, total, page, limit);
}

async function getDailyReport(schoolId, date) {
  const targetDate = date ? new Date(date) : new Date();
  const start = new Date(targetDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(targetDate);
  end.setHours(23, 59, 59, 999);

  const [transactions, summary] = await Promise.all([
    prisma.canteenTransaction.findMany({
      where: { school_id: schoolId, transaction_time: { gte: start, lte: end } },
      include: {
        student: { include: { user: { select: { first_name: true, last_name: true } } } },
      },
      orderBy: { transaction_time: 'desc' },
    }),
    prisma.canteenTransaction.aggregate({
      where: { school_id: schoolId, transaction_time: { gte: start, lte: end } },
      _sum: { total_amount: true },
      _count: true,
    }),
  ]);

  return {
    transactions,
    total_revenue: summary._sum.total_amount || 0,
    transaction_count: summary._count,
  };
}

module.exports = { purchase, getStudentTransactions, getDailyReport };
