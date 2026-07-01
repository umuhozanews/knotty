const prisma = require('../../config/database');
const { paginate, paginatedResponse } = require('../../utils/helpers');

async function purchase({ card_number, items, served_by, school_id }) {
  if (!Array.isArray(items) || items.length === 0) {
    throw Object.assign(new Error('items must be a non-empty array'), { status: 400 });
  }
  for (const item of items) {
    const price = Number(item.price);
    const qty = Number(item.quantity);
    if (!Number.isFinite(price) || price <= 0) {
      throw Object.assign(new Error(`Invalid price for item: ${item.name || 'unknown'}`), { status: 400 });
    }
    if (!Number.isFinite(qty) || qty <= 0) {
      throw Object.assign(new Error(`Invalid quantity for item: ${item.name || 'unknown'}`), { status: 400 });
    }
  }

  const card = await prisma.knottyCard.findFirst({ where: { card_number, school_id } });
  if (!card) throw Object.assign(new Error('Card not found'), { status: 404 });
  if (!card.is_active || card.is_frozen) throw Object.assign(new Error('Card not usable'), { status: 403 });

  const total_amount = items.reduce((sum, item) => sum + Number(item.price) * Number(item.quantity), 0);

  return prisma.$transaction(async (tx) => {
    // Duplicate guard: reject if this card was charged within the last 5 seconds
    const recentTxn = await tx.canteenTransaction.findFirst({
      where: {
        card_id: card.id,
        transaction_time: { gte: new Date(Date.now() - 5000) },
      },
    });
    if (recentTxn) {
      throw Object.assign(
        new Error('Duplicate transaction detected — please wait a moment before retrying'),
        { status: 409 }
      );
    }

    // Atomically deduct balance only if card is still usable and has enough funds.
    // Using updateMany with a WHERE guard makes the balance check + deduction a single
    // atomic DB operation, eliminating the TOCTOU race between check and update.
    const updateResult = await tx.knottyCard.updateMany({
      where: {
        id: card.id,
        is_active: true,
        is_frozen: false,
        wallet_balance: { gte: total_amount },
      },
      data: { wallet_balance: { decrement: total_amount } },
    });

    if (updateResult.count === 0) {
      const freshCard = await tx.knottyCard.findUnique({ where: { id: card.id } });
      if (!freshCard || !freshCard.is_active || freshCard.is_frozen) {
        throw Object.assign(new Error('Card not usable'), { status: 403 });
      }
      throw Object.assign(
        new Error(`Insufficient balance. Balance: ${freshCard.wallet_balance} RWF, Required: ${total_amount} RWF`),
        { status: 400 }
      );
    }

    const updatedCard = await tx.knottyCard.findUnique({ where: { id: card.id } });
    const balanceBefore = updatedCard.wallet_balance + total_amount;

    const txn = await tx.canteenTransaction.create({
      data: {
        student_id: card.student_id,
        school_id,
        card_id: card.id,
        items_purchased: items,
        total_amount,
        wallet_balance_before: balanceBefore,
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
        balance_before: balanceBefore,
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

  // Build per-item sales breakdown from items_purchased JSON arrays
  const itemMap = {};
  for (const txn of transactions) {
    const items = Array.isArray(txn.items_purchased) ? txn.items_purchased : [];
    for (const item of items) {
      const key = item.name || 'Unknown';
      if (!itemMap[key]) itemMap[key] = { name: key, quantity: 0, revenue: 0 };
      itemMap[key].quantity += Number(item.quantity) || 0;
      itemMap[key].revenue += (Number(item.price) || 0) * (Number(item.quantity) || 0);
    }
  }
  const items_summary = Object.values(itemMap).sort((a, b) => b.revenue - a.revenue);

  return {
    transactions,
    total_revenue: summary._sum.total_amount || 0,
    transaction_count: summary._count,
    items_summary,
  };
}

async function listProducts(schoolId) {
  return prisma.canteenProduct.findMany({
    where: { school_id: schoolId, is_active: true },
    orderBy: { created_at: 'asc' },
  });
}

async function createProduct({ school_id, name, price, category, emoji, photo_url }) {
  if (!name?.trim()) throw Object.assign(new Error('Product name required'), { status: 400 });
  const p = Number(price);
  if (!Number.isFinite(p) || p <= 0) throw Object.assign(new Error('Invalid price'), { status: 400 });
  return prisma.canteenProduct.create({
    data: { school_id, name: name.trim(), price: Math.round(p), category: category || 'Other', emoji: emoji || '🍽️', photo_url: photo_url || null },
  });
}

async function deleteProduct(id, schoolId) {
  const product = await prisma.canteenProduct.findFirst({ where: { id, school_id: schoolId } });
  if (!product) throw Object.assign(new Error('Product not found'), { status: 404 });
  await prisma.canteenProduct.update({ where: { id }, data: { is_active: false } });
}

module.exports = { purchase, getStudentTransactions, getDailyReport, listProducts, createProduct, deleteProduct };
