const prisma = require('../../config/database');
const { generateCardNumber } = require('../../utils/cardNumberGenerator');
const { generateQRCode } = require('../../utils/qrGenerator');
const momoService = require('../../integrations/mtn-momo');
const { paginate, paginatedResponse } = require('../../utils/helpers');

async function issueCard(studentId, schoolId) {
  const student = await prisma.student.findFirst({
    where: { id: studentId, school_id: schoolId },
    include: { card: true, school: true },
  });
  if (!student) throw Object.assign(new Error('Student not found'), { status: 404 });
  if (student.card) throw Object.assign(new Error('Student already has a card'), { status: 409 });

  const card_number = await generateCardNumber(student.school.code);
  const qrData = { card_number, student_id: studentId, school_id: schoolId };
  const qr_code = await generateQRCode(qrData);

  const expires_at = new Date();
  expires_at.setFullYear(expires_at.getFullYear() + 2);

  return prisma.knottyCard.create({
    data: {
      student_id: studentId,
      school_id: schoolId,
      card_number,
      qr_code,
      expires_at,
    },
    include: {
      student: {
        include: { user: { select: { first_name: true, last_name: true, profile_photo: true } } },
      },
    },
  });
}

async function scanCard(cardNumber) {
  const card = await prisma.knottyCard.findUnique({
    where: { card_number: cardNumber },
    include: {
      student: {
        include: {
          user: { select: { first_name: true, last_name: true, profile_photo: true } },
          class: { select: { name: true } },
          level: { select: { name: true } },
          school: { select: { name: true, logo: true, tap_out_after_minutes: true } },
        },
      },
    },
  });

  if (!card) throw Object.assign(new Error('Card not found'), { status: 404 });
  if (!card.is_active) throw Object.assign(new Error('Card is inactive'), { status: 403 });
  if (card.is_frozen) throw Object.assign(new Error('Card is frozen'), { status: 403 });
  if (new Date() > card.expires_at) throw Object.assign(new Error('Card has expired'), { status: 403 });

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const attendance = await prisma.attendance.findFirst({
    where: { student_id: card.student_id, date: today },
  });

  return {
    card_number: card.card_number,
    wallet_balance: card.wallet_balance,
    issued_at: card.issued_at,
    expires_at: card.expires_at,
    is_frozen: card.is_frozen,
    student: {
      id: card.student.id,
      name: `${card.student.user.first_name} ${card.student.user.last_name}`,
      photo: card.student.user.profile_photo,
      class: `${card.student.level?.name || ''} ${card.student.class?.name || ''}`.trim(),
      student_code: card.student.student_code,
      school_name: card.student.school?.name || '',
      school_logo: card.student.school?.logo || null,
    },
    today_attendance: attendance?.status || null,
    tap_out_available_at: attendance?.check_in_time && !attendance.check_out_time
      ? new Date(new Date(attendance.check_in_time).getTime() + (card.student.school?.tap_out_after_minutes ?? 180) * 60000).toISOString()
      : null,
    check_in_time:  attendance?.check_in_time  || null,
    check_out_time: attendance?.check_out_time || null,
  };
}

async function freezeCard(id, schoolId) {
  return prisma.knottyCard.updateMany({
    where: { id, school_id: schoolId },
    data: { is_frozen: true },
  });
}

async function unfreezeCard(id, schoolId) {
  return prisma.knottyCard.updateMany({
    where: { id, school_id: schoolId },
    data: { is_frozen: false },
  });
}

async function topUpWallet(cardId, { amount, phone, schoolId }) {
  const card = await prisma.knottyCard.findFirst({ where: { id: cardId, school_id: schoolId } });
  if (!card) throw Object.assign(new Error('Card not found'), { status: 404 });
  if (!card.is_active) throw Object.assign(new Error('Card is inactive'), { status: 403 });

  if (amount < 100) throw Object.assign(new Error('Minimum top-up is 100 RWF'), { status: 400 });

  const referenceId = await momoService.requestTopUp({
    amount,
    phone,
    description: `KNOTTY Wallet Top-Up for ${card.card_number}`,
  });

  // Store pending transaction — will be credited on webhook
  await prisma.walletTransaction.create({
    data: {
      card_id: cardId,
      student_id: card.student_id,
      school_id: schoolId,
      type: 'TOP_UP',
      amount,
      balance_before: card.wallet_balance,
      balance_after: card.wallet_balance,
      source: 'MOMO',
      momo_reference: referenceId,
      description: 'Wallet top-up via MTN MoMo (pending)',
    },
  });

  return { referenceId, message: 'Payment request sent. Awaiting USSD confirmation.' };
}

async function confirmTopUp(momoReference) {
  const txn = await prisma.walletTransaction.findFirst({
    where: { momo_reference: momoReference, type: 'TOP_UP' },
  });
  if (!txn) throw Object.assign(new Error('Transaction not found'), { status: 404 });

  const status = await momoService.getTransactionStatus(momoReference);
  if (status.status !== 'SUCCESSFUL') {
    throw Object.assign(new Error(`Payment not successful: ${status.status}`), { status: 400 });
  }

  return prisma.$transaction(async (tx) => {
    const card = await tx.knottyCard.update({
      where: { id: txn.card_id },
      data: { wallet_balance: { increment: txn.amount } },
    });

    await tx.walletTransaction.update({
      where: { id: txn.id },
      data: {
        balance_after: card.wallet_balance,
        description: 'Wallet top-up via MTN MoMo (confirmed)',
      },
    });

    return card;
  });
}

async function getTransactions(cardId, schoolId, { page, limit }) {
  const card = await prisma.knottyCard.findFirst({ where: { id: cardId, school_id: schoolId } });
  if (!card) throw Object.assign(new Error('Card not found'), { status: 404 });

  const { skip, take } = paginate(null, page, limit);
  const [data, total] = await Promise.all([
    prisma.walletTransaction.findMany({
      where: { card_id: cardId },
      skip,
      take,
      orderBy: { created_at: 'desc' },
    }),
    prisma.walletTransaction.count({ where: { card_id: cardId } }),
  ]);

  return paginatedResponse(data, total, page, limit);
}

async function linkNFC(cardId, schoolId, nfcUid) {
  const card = await prisma.knottyCard.findFirst({ where: { id: cardId, school_id: schoolId } });
  if (!card) throw Object.assign(new Error('Card not found'), { status: 404 });
  const conflict = await prisma.knottyCard.findFirst({ where: { nfc_uid: nfcUid, NOT: { id: cardId } } });
  if (conflict) throw Object.assign(new Error('NFC tag already linked to another card'), { status: 409 });
  return prisma.knottyCard.update({ where: { id: cardId }, data: { nfc_uid: nfcUid } });
}

async function scanByNFC(nfcUid) {
  const card = await prisma.knottyCard.findFirst({ where: { nfc_uid: nfcUid } });
  if (!card) throw Object.assign(new Error('NFC tag not linked to any card'), { status: 404 });
  return scanCard(card.card_number);
}

async function cashTopUp(cardId, schoolId, amount, recordedBy) {
  const card = await prisma.knottyCard.findFirst({ where: { id: cardId, school_id: schoolId } });
  if (!card) throw Object.assign(new Error('Card not found'), { status: 404 });
  if (!card.is_active) throw Object.assign(new Error('Card is inactive'), { status: 403 });
  if (amount < 100) throw Object.assign(new Error('Minimum top-up is 100 RWF'), { status: 400 });

  return prisma.$transaction(async (tx) => {
    const updated = await tx.knottyCard.update({
      where: { id: cardId },
      data: { wallet_balance: { increment: amount } },
    });
    await tx.walletTransaction.create({
      data: {
        card_id: cardId,
        student_id: card.student_id,
        school_id: schoolId,
        type: 'TOP_UP',
        amount,
        balance_before: card.wallet_balance,
        balance_after: updated.wallet_balance,
        source: 'CASH',
        description: 'Cash top-up by admin',
      },
    });
    return updated;
  });
}

async function listCards(schoolId, { page, limit, search }) {
  const { skip, take } = paginate(null, page, limit);
  const where = {
    school_id: schoolId,
    ...(search && {
      OR: [
        { card_number: { contains: search, mode: 'insensitive' } },
        { student: { user: { first_name: { contains: search, mode: 'insensitive' } } } },
        { student: { user: { last_name: { contains: search, mode: 'insensitive' } } } },
        { student: { student_code: { contains: search, mode: 'insensitive' } } },
      ],
    }),
  };
  const [data, total] = await Promise.all([
    prisma.knottyCard.findMany({
      where,
      skip,
      take,
      include: {
        student: {
          include: {
            user: { select: { first_name: true, last_name: true, profile_photo: true } },
            level: { select: { name: true } },
            class: { select: { name: true } },
          },
        },
      },
      orderBy: { issued_at: 'desc' },
    }),
    prisma.knottyCard.count({ where }),
  ]);
  return paginatedResponse(data, total, page, limit);
}

async function generateSecureQR(userId) {
  const student = await prisma.student.findUnique({
    where: { user_id: userId },
    include: { card: true },
  });
  if (!student) throw Object.assign(new Error('Student profile not found'), { status: 404 });
  if (!student.card) throw Object.assign(new Error('KNOTTY Card not issued yet'), { status: 404 });
  if (!student.card.is_active || student.card.is_frozen) {
    throw Object.assign(new Error('KNOTTY Card is inactive or frozen'), { status: 403 });
  }

  const crypto = require('crypto');
  const cardNumber = student.card.card_number;
  const expiryTime = Date.now() + 30000; // 30 seconds
  const message = `${cardNumber}:${expiryTime}`;
  
  const signature = crypto.createHmac('sha256', process.env.JWT_SECRET)
    .update(message)
    .digest('base64url');

  const token = `KS:${cardNumber}:${expiryTime}:${signature}`;
  const qr_code = await generateQRCode(token);

  return {
    token,
    qr_code,
    expires_at: new Date(expiryTime).toISOString(),
  };
}

module.exports = { issueCard, scanCard, freezeCard, unfreezeCard, topUpWallet, confirmTopUp, getTransactions, linkNFC, scanByNFC, cashTopUp, listCards, generateSecureQR };
