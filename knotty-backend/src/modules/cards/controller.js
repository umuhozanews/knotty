const service = require('./service');

async function issue(req, res, next) {
  try {
    const card = await service.issueCard(req.params.studentId, req.user.school_id);
    res.status(201).json({ success: true, data: card });
  } catch (err) { next(err); }
}

async function scan(req, res, next) {
  try {
    const data = await service.scanCard(req.params.cardNumber);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

async function freeze(req, res, next) {
  try {
    await service.freezeCard(req.params.id, req.user.school_id);
    res.json({ success: true, message: 'Card frozen' });
  } catch (err) { next(err); }
}

async function unfreeze(req, res, next) {
  try {
    await service.unfreezeCard(req.params.id, req.user.school_id);
    res.json({ success: true, message: 'Card unfrozen' });
  } catch (err) { next(err); }
}

async function topUp(req, res, next) {
  try {
    const result = await service.topUpWallet(req.params.id, {
      ...req.body,
      schoolId: req.user.school_id,
    });
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
}

async function momoWebhook(req, res, next) {
  try {
    const { referenceId } = req.params;
    await service.confirmTopUp(referenceId);
    res.json({ success: true, message: 'Wallet credited' });
  } catch (err) { next(err); }
}

async function transactions(req, res, next) {
  try {
    const { page = 1, limit = 20 } = req.query;
    const result = await service.getTransactions(req.params.id, req.user.school_id, { page, limit });
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
}

async function linkNFC(req, res, next) {
  try {
    const card = await service.linkNFC(req.params.id, req.user.school_id, req.body.nfc_uid);
    res.json({ success: true, data: card });
  } catch (err) { next(err); }
}

async function scanNFC(req, res, next) {
  try {
    const data = await service.scanByNFC(req.params.nfcUid);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

async function cashTopUp(req, res, next) {
  try {
    const card = await service.cashTopUp(req.params.id, req.user.school_id, req.body.amount, req.user.id);
    res.json({ success: true, data: card });
  } catch (err) { next(err); }
}

async function list(req, res, next) {
  try {
    const { page = 1, limit = 20, search } = req.query;
    const result = await service.listCards(req.user.school_id, { page, limit, search });
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
}

async function mySecureQR(req, res, next) {
  try {
    const result = await service.generateSecureQR(req.user.id);
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
}

module.exports = { issue, scan, freeze, unfreeze, topUp, momoWebhook, transactions, linkNFC, scanNFC, cashTopUp, list, mySecureQR };
