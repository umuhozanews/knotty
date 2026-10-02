const prisma = require('../../config/database');
const redis = require('../../config/redis');
const { logAction } = require('../../utils/audit');
const { paginate, paginatedResponse } = require('../../utils/helpers');

const PRODUCTS_TTL = 300; // 5 minutes — products rarely change

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

  const result = await prisma.$transaction(async (tx) => {
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

    // Check daily spending limit if set on card
    if (card.daily_limit && card.daily_limit > 0) {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);

      const todayAgg = await tx.canteenTransaction.aggregate({
        where: {
          card_id: card.id,
          transaction_time: { gte: todayStart, lte: todayEnd },
        },
        _sum: { total_amount: true },
      });
      const spentToday = todayAgg._sum.total_amount || 0;
      if (spentToday + total_amount > card.daily_limit) {
        throw Object.assign(
          new Error(`Daily spending limit exceeded. Limit: ${card.daily_limit.toLocaleString()} RWF (spent today: ${spentToday.toLocaleString()} RWF, trying: ${total_amount.toLocaleString()} RWF)`),
          { status: 400 }
        );
      }
    }

    // Verify and decrement stock for inventory-tracked products
    for (const item of items) {
      const qty = Math.max(1, Number(item.quantity) || 1);
      const prod = item.id
        ? await tx.canteenProduct.findFirst({ where: { id: item.id, school_id } })
        : await tx.canteenProduct.findFirst({ where: { name: item.name, school_id, is_active: true } });

      if (prod && prod.stock_qty !== null && prod.stock_qty !== undefined) {
        if (prod.stock_qty < qty) {
          throw Object.assign(
            new Error(`"${prod.name}" has insufficient stock (${prod.stock_qty} left, requested ${qty})`),
            { status: 400 }
          );
        }
        await tx.canteenProduct.update({
          where: { id: prod.id },
          data: { stock_qty: { decrement: qty } },
        });
      }
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

  // Bust the card scan and product catalog cache so the next tap shows the updated balance and stock
  if (redis) {
    redis.del(`card:${card_number}`).catch(() => {});
    redis.del(`canteen_products:${school_id}`).catch(() => {});
  }

  logAction({
    school_id,
    actor_user_id: served_by,
    action: 'CANTEEN_PURCHASE',
    entity_type: 'CanteenTransaction',
    entity_id: result.transaction.id,
    after_state: {
      total_amount,
      items_count: items.length,
      new_balance: result.new_balance,
      card_number,
    },
  }).catch(() => {});

  return result;
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
  const cacheKey = `canteen_products:${schoolId}`;
  try {
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached);
  } catch (_) {}

  const products = await prisma.canteenProduct.findMany({
    where: { school_id: schoolId, is_active: true },
    orderBy: { created_at: 'asc' },
  });
  redis.set(cacheKey, JSON.stringify(products), 'EX', PRODUCTS_TTL).catch(() => {});
  return products;
}

async function createProduct({ school_id, name, price, category, emoji, photo_url, stock_qty }) {
  if (!name?.trim()) throw Object.assign(new Error('Product name required'), { status: 400 });
  const p = Number(price);
  if (!Number.isFinite(p) || p <= 0) throw Object.assign(new Error('Invalid price'), { status: 400 });

  let parsedStock = null;
  if (stock_qty !== undefined && stock_qty !== null && stock_qty !== '') {
    const s = parseInt(stock_qty, 10);
    parsedStock = isNaN(s) ? null : Math.max(0, s);
  }

  const product = await prisma.canteenProduct.create({
    data: {
      school_id,
      name: name.trim(),
      price: Math.round(p),
      category: category || 'Other',
      emoji: emoji || 'food',
      photo_url: photo_url || null,
      stock_qty: parsedStock,
    },
  });
  redis.del(`canteen_products:${school_id}`).catch(() => {});
  return product;
}

async function updateProduct(id, schoolId, data) {
  const product = await prisma.canteenProduct.findFirst({ where: { id, school_id: schoolId } });
  if (!product) throw Object.assign(new Error('Product not found'), { status: 404 });

  const updateData = {};
  if (data.name !== undefined) updateData.name = data.name.trim();
  if (data.price !== undefined) {
    const p = Number(data.price);
    if (!Number.isFinite(p) || p <= 0) throw Object.assign(new Error('Invalid price'), { status: 400 });
    updateData.price = Math.round(p);
  }
  if (data.category !== undefined) updateData.category = data.category;
  if (data.emoji !== undefined) updateData.emoji = data.emoji;
  if (data.photo_url !== undefined) updateData.photo_url = data.photo_url;
  if (data.is_active !== undefined) updateData.is_active = Boolean(data.is_active);
  if (data.stock_qty !== undefined) {
    if (data.stock_qty === null || data.stock_qty === '') {
      updateData.stock_qty = null;
    } else {
      const s = parseInt(data.stock_qty, 10);
      updateData.stock_qty = isNaN(s) ? null : Math.max(0, s);
    }
  }

  const updated = await prisma.canteenProduct.update({
    where: { id },
    data: updateData,
  });
  redis.del(`canteen_products:${schoolId}`).catch(() => {});
  return updated;
}

async function restockProduct(id, schoolId, quantityToAdd) {
  const qty = parseInt(quantityToAdd, 10);
  if (!Number.isFinite(qty) || qty <= 0) {
    throw Object.assign(new Error('Restock quantity must be a positive integer'), { status: 400 });
  }
  const product = await prisma.canteenProduct.findFirst({ where: { id, school_id: schoolId } });
  if (!product) throw Object.assign(new Error('Product not found'), { status: 404 });

  const currentStock = product.stock_qty ?? 0;
  const updated = await prisma.canteenProduct.update({
    where: { id },
    data: { stock_qty: currentStock + qty },
  });
  redis.del(`canteen_products:${schoolId}`).catch(() => {});
  return updated;
}

async function deleteProduct(id, schoolId) {
  const product = await prisma.canteenProduct.findFirst({ where: { id, school_id: schoolId } });
  if (!product) throw Object.assign(new Error('Product not found'), { status: 404 });
  await prisma.canteenProduct.update({ where: { id }, data: { is_active: false } });
  redis.del(`canteen_products:${schoolId}`).catch(() => {});
}

module.exports = {
  purchase,
  getStudentTransactions,
  getDailyReport,
  listProducts,
  createProduct,
  updateProduct,
  restockProduct,
  deleteProduct,
};
